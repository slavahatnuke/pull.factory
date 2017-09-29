module.exports = class PullFactory {
  constructor(creator, options = {}) {
    this.creator = creator;

    this.destructor = null;
    this.destructResolver = null;
    this.options = Object.assign({limit: 1}, options);

    this.useQueue = [];
    this.instanceRegistry = [];

    this.limit = this.options.limit;

    this.handleCounter = 0;
  }

  setLimit(limit = null) {
    this.limit = limit;
  }

  setDestructor(fn) {
    if (!(fn instanceof Function)) {
      throw new Error('Destructor must be function');
    }

    this.destructor = fn;
  }

  use(fn) {
    if (!(fn instanceof Function)) {
      throw new Error('Getter must be function');
    }

    const promise = new Promise((resolve, reject) => {
      this.useQueue.push({resolve, reject, fn});
      this.handle();
    });

    return promise;
  }

  handle() {
    if (this.handleCounter >= this.limit) {
      return;
    }

    this.handleCounter++;

    return Promise.resolve()
      .then(() => {
        if (this.useQueue.length) {

          const {resolve, reject, fn} = this.useQueue.shift();

          return this._getIt()
            .then((it) => {
              if (!it) {
                this.useQueue.push({resolve, reject, fn});
                this.handleCounter--;
                return null;
              }

              return Promise.resolve()
                .then(() => this._markAsBusy(it))
                .then(() => fn(it))
                .then((result) => this._markAsFree(it).then(() => result))
                .catch((error) => this._unregister(it).then(() => Promise.reject(error)))
                .then((result) => {
                  resolve(result);
                  return result;
                })
                .catch((error) => {
                  reject(error);
                  return null;
                })
                .then(() => this.handleCounter--)
                .then(() => this.handle())
            })
        } else {
          this.handleCounter--;
        }
      })
  }

  _hasFreeSlot() {
    return Promise.resolve()
      .then(() => {
        if (this.destructResolver) {
          return false;
        }

        if (this.instanceRegistry.length < this.limit) {
          return true;
        } else {
          return !!this.instanceRegistry.find(({free}) => free);
        }
      })
  }

  _markAsBusy(it) {
    return this._findItEntry(it)
      .then((entry) => {
        entry.free = false;
      })
  }

  _markAsFree(it) {
    return this._findItEntry(it)
      .then((entry) => {
        entry.free = true;

        if (this.instanceRegistry.length > this.limit && this.destructor) {
          this.instanceRegistry = this.instanceRegistry.filter((anEntry) => anEntry !== entry);
          this.destructor(it);
        }

        if (this._isFree() && this.destructResolver) {
          this.destructResolver();
          this.destructResolver = null;
        }

      })
  }

  _isFree() {
    return this.instanceRegistry.every(({free}) => free);
  }


  _getIt() {
    return Promise.resolve()
      .then(() => this._hasFreeSlot())
      .then((hasFreeSlot) => {
        if (!hasFreeSlot) {
          return null;
        }

        return Promise.resolve()
          .then(() => this._findFree())
          .then(({it}) => {
            if (it) {
              return it;
            }

            return Promise.resolve(this.creator())
              .then((it) => {
                //create and register
                return this._register(it)
                  .then(() => it);
              });
          })

      })
  }

  _findFree() {
    return Promise.resolve()
      .then(() => (this.instanceRegistry.find(({free}) => free) || {}));
  }

  _findItEntry(it) {
    return Promise.resolve()
      .then(() => (this.instanceRegistry.find(({it: anIt}) => anIt === it) || {}));
  }

  _register(it) {
    return Promise.resolve()
      .then(() => {
        return this.instanceRegistry.push({it, free: true});
      })
  }

  _unregister(it) {
    return Promise.resolve()
      .then(() => {
        this.instanceRegistry = this.instanceRegistry.filter(({it: anIt}) => anIt !== it)
      })
  }

  destruct() {
    return Promise.resolve()
      .then(() => {
        if (this.destructor) {
          return Promise.resolve()
            .then(() => {
              return new Promise((resolve, reject) => {
                this.destructResolver = resolve;

                if (!this.instanceRegistry.length) {
                  this.destructResolver();
                  this.destructResolver = null;
                }
              })
            })
            .then(() => {
              const instanceRegistry = this.instanceRegistry;
              this.instanceRegistry = [];
              return Promise.all(instanceRegistry.map(({it}) => Promise.resolve(this.destructor(it))))
            });
        }
      })
  }
};