const path = require('path');
const assert = require('assert').strict;
const Method = require('./Method');

const objMap = (obj, fn) => Object.fromEntries(Object.entries(obj).map(fn));

class Version {
  static fromYamlFile(content, filename) {
    Version._checkContent(content, filename);

    return new Version(
      content.version,
      content.migrationScript,
      objMap(content.methods,
        ([name, meth]) => [name, Method.fromYamlFile(name, meth, filename)]),
    );
  }

  static fromSerializable(serializable) {
    for (let k of Object.keys(serializable)) {
      if (!['methods', 'migrationScript', 'version'].includes(k)) {
        throw new Error(`unexpected version key ${k}`);
      }
    }
    return new Version(
      serializable.version,
      serializable.migrationScript,
      objMap(serializable.methods,
        ([name, meth]) => [name, Method.fromSerializable(name, meth)]),
    );
  }

  asSerializable() {
    return {
      version: this.version,
      migrationScript: this.migrationScript,
      methods: objMap(this.methods, ([name, meth]) => [name, meth.asSerializable()]),
    };
  }

  constructor(version, migrationScript, methods) {
    this.version = version;
    this.migrationScript = migrationScript;
    this.methods = methods;
  }

  static _checkContent(content, filename) {
    assert(content.version, `version field missing in ${filename}`);
    assert(content.migrationScript, `migrationScript field missing in ${filename}`);
    assert(content.methods, `methods field missing in ${filename}`);

    assert(Object.keys(content).length, 3, `unknown fields in ${filename}`);

    const fileBase = path.basename(filename, '.yml');
    assert.equal(content.version, Number(fileBase), `filename ${filename} must match version`);

    Object.keys(content.methods).forEach(name => {
      assert(!/.*[A-Z].*/.test(name), `db function method ${name} in ${filename} has capital letters`);
      const method = content.methods[name];

      assert.deepEqual(Object.keys(method).sort(), [
        'args',
        'body',
        'description',
        'mode',
        'returns',
        'serviceName',
      ], `unexpected or missing properties in method ${name} in ${filename}`);
    });
  }

}

module.exports = Version;
