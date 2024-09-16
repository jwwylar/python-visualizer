const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const gulp = require('gulp');
const del = require('del');
const filter = require('gulp-filter');
const parseSemver = require('parse-semver');
const _ = require('underscore');

function asYarnDependency(prefix, tree) {
  let parseResult;

  try {
    parseResult = parseSemver(tree.name);
  } catch (err) {
    err.message += `: ${tree.name}`;
    console.warn(`Could not parse semver: ${tree.name}`);
    return null;
  }

  if (parseResult.version !== parseResult.range) {
    return null;
  }

  const name = parseResult.name;
  const version = parseResult.version;
  const dependencyPath = path.join(prefix, name);
  const children = [];

  for (const child of (tree.children || [])) {
    const dep = asYarnDependency(path.join(prefix, name, 'node_modules'), child);

    if (dep) {
      children.push(dep);
    }
  }

  return { name, version, path: dependencyPath, children };
}

function getYarnProductionDependencies(cwd) {
  const raw = cp.execSync(`yarn list --json`, { cwd, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' }, stdio: [null, null, 'ignore'] });
  const match = /^{"type":"tree".*$/m.exec(raw);

  if (!match || match.length !== 1) {
    throw new Error('Could not parse result of `yarn lst --json`');
  }

  const trees = JSON.parse(match[0]).data.trees;

  return trees.map(tree => asYarnDependency(path.join(cwd, 'node_modules'), tree))
    .filter(dep => !!dep);
}

function getProductionDependencies(cwd) {
  const result = [];
  const deps = getYarnProductionDependencies(cwd);
  const flatten = dep => { result.push({ name: dep.name, version: dep.version, path: dep.path }); dep.children.forEach(flatten) };
  deps.forEach(flatten);

  return _.uniq(result);
}

function cleanPythonVisualizer() {
  return del(['python-visualizer']);
}

function extractPythonVisualizer() {
  const pythonVisualizerIgnore = fs.readFileSync('./.testignore', 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(line => '!' + line);
  const pythonVisualizerFilter = filter(['**', '!node_modules/**', '!node_modules', ...pythonVisualizerIgnore]);

  return gulp.src('./**', { base: '.' })
    .pipe(pythonVisualizerFilter)
    .pipe(gulp.dest('python-visualizer'))
    .pipe(gulp.src(getProductionDependencies(__dirname).map(dep => path.join(dep.path, '**')), { base: './node_modules' }))
    .pipe(gulp.dest('./python-visualizer/node_modules'));
}

gulp.task('cleanPythonVisualizer', cleanPythonVisualizer);
gulp.task('extractPythonVisualizer', gulp.series('cleanPythonVisualizer', extractPythonVisualizer));

