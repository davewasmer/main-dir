const Module = require('module');
// Copied straight from node source, changes marked with:
//     
//     // ---------- START CHANGE -----------
//     <... changed code ...>
//     // ---------- END CHANGE -------------
//
// The rest of the code is included because it is locally
// scoped to node's internal module.js source file, so we
// need to duplicate it out here.


const fs = require('fs');
const path = require('path');
const internalModuleReadFile = process.binding('fs').internalModuleReadFile;
const internalModuleStat = process.binding('fs').internalModuleStat;
const preserveSymlinks = !!process.binding('config').preserveSymlinks;

function stat(filename) {
  filename = path._makeLong(filename);
  const cache = stat.cache;
  if (cache !== null) {
    const result = cache.get(filename);
    if (result !== undefined) return result;
  }
  const result = internalModuleStat(filename);
  if (cache !== null) cache.set(filename, result);
  return result;
}
stat.cache = null;


// check if the directory is a package.json dir
const packageMainCache = Object.create(null);

function readPackage(requestPath) {
  const entry = packageMainCache[requestPath];
  if (entry)
    return entry;

  const jsonPath = path.resolve(requestPath, 'package.json');
  const json = internalModuleReadFile(path._makeLong(jsonPath));

  if (json === undefined) {
    return false;
  }

  // ---------- START CHANGE -----------
  try {
    var pkg = JSON.parse(json);
  } catch (e) {
    e.path = jsonPath;
    e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
    throw e;
  }
  let pkgPath;
  if (pkg.mainDir) {
    if (pkg.main) {
      pkgPath = path.join(pkg.mainDir, pkg.main); 
    } else {
      pkgPath = path.join(pkg.mainDir, 'index.js');
    }
  } else {
    pkgPath = pkg.main;
  }

  return pkgPath;
  // ---------- END CHANGE -------------
}

function tryPackage(requestPath, exts, isMain) {
  var pkg = readPackage(requestPath);

  if (!pkg) return false;

  var filename = path.resolve(requestPath, pkg);
  return tryFile(filename, isMain) ||
         tryExtensions(filename, exts, isMain) ||
         tryExtensions(path.resolve(filename, 'index'), exts, isMain);
}

// In order to minimize unnecessary lstat() calls,
// this cache is a list of known-real paths.
// Set to an empty Map to reset.
const realpathCache = new Map();

// check if the file exists and is not a directory
// if using --preserve-symlinks and isMain is false,
// keep symlinks intact, otherwise resolve to the
// absolute realpath.
function tryFile(requestPath, isMain) {
  const rc = stat(requestPath);
  if (preserveSymlinks && !isMain) {
    return rc === 0 && path.resolve(requestPath);
  }
  return rc === 0 && toRealPath(requestPath);
}

function toRealPath(requestPath) {
  if (!realpathCache.has(requestPath)) {
    realpathCache.set(requestPath, fs.realpathSync(requestPath));
  }
  return realpathCache.get(requestPath);
}

// given a path check a the file exists with any of the set extensions
function tryExtensions(p, exts, isMain) {
  for (var i = 0; i < exts.length; i++) {
    const filename = tryFile(p + exts[i], isMain);

    if (filename) {
      return filename;
    }
  }
  return false;
}

var warned = false;
Module._findPath = function(request, paths, isMain) {
  if (path.isAbsolute(request)) {
    paths = [''];
  } else if (!paths || paths.length === 0) {
    return false;
  }

  var cacheKey = request + '\x00' +
                (paths.length === 1 ? paths[0] : paths.join('\x00'));
  var entry = Module._pathCache[cacheKey];
  if (entry)
    return entry;

  var exts;
  var trailingSlash = request.length > 0 &&
                      request.charCodeAt(request.length - 1) === 47/*/*/;

  // For each path
  for (var i = 0; i < paths.length; i++) {
    // Don't search further if path doesn't exist
    const curPath = paths[i];
    if (curPath && stat(curPath) < 1) continue;
    var basePath = path.resolve(curPath, request);
    var filename;

    var rc = stat(basePath);
    if (!trailingSlash) {
      if (rc === 0) {  // File.
        if (preserveSymlinks && !isMain) {
          filename = path.resolve(basePath);
        } else {
          filename = toRealPath(basePath);
        }
      } else if (rc === 1) {  // Directory.
        if (exts === undefined)
          exts = Object.keys(Module._extensions);
        filename = tryPackage(basePath, exts, isMain);
      }

      if (!filename) {
        // try it with each of the extensions
        if (exts === undefined)
          exts = Object.keys(Module._extensions);
        filename = tryExtensions(basePath, exts, isMain);
      }
    }

    if (!filename && rc === 1) {  // Directory.
      if (exts === undefined)
        exts = Object.keys(Module._extensions);
      filename = tryPackage(basePath, exts, isMain);
    }

    if (!filename && rc === 1) {  // Directory.
      // try it with each of the extensions at "index"
      if (exts === undefined)
        exts = Object.keys(Module._extensions);
      filename = tryExtensions(path.resolve(basePath, 'index'), exts, isMain);
    }

    if (filename) {
      // Warn once if '.' resolved outside the module dir
      if (request === '.' && i > 0) {
        if (!warned) {
          warned = true;
          process.emitWarning(
            'warning: require(\'.\') resolved outside the package ' +
            'directory. This functionality is deprecated and will be removed ' +
            'soon.',
            'DeprecationWarning', 'DEP0019');
        }
      }

      Module._pathCache[cacheKey] = filename;
      return filename;
    }
  }
  return false;
};