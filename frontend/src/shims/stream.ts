// Browser shim for Node.js 'stream' module needed by printf/JSCPP
export class Stream {
  pipe() {
    return this;
  }
}

export class Readable extends Stream {}
export class Writable extends Stream {}
export class Transform extends Stream {}
export class Duplex extends Stream {}

export default {
  Stream,
  Readable,
  Writable,
  Transform,
  Duplex,
};
