/*!
 * w-converhp-server v1.0.26
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('@hapi/hapi'), require('@hapi/inert'), require('events'), require('stream'), require('crypto')) :
  typeof define === 'function' && define.amd ? define(['@hapi/hapi', '@hapi/inert', 'events', 'stream', 'crypto'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global['w-converhp-server'] = factory(global['@hapi/hapi'], global['@hapi/inert'], global.events, global.stream, global.crypto));
}(this, (function (Hapi, Inert, events, stream, require$$0) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var Hapi__default = /*#__PURE__*/_interopDefaultLegacy(Hapi);
  var Inert__default = /*#__PURE__*/_interopDefaultLegacy(Inert);
  var events__default = /*#__PURE__*/_interopDefaultLegacy(events);
  var stream__default = /*#__PURE__*/_interopDefaultLegacy(stream);
  var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  function _typeof(obj) {
    "@babel/helpers - typeof";

    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function _typeof(obj) {
        return typeof obj;
      };
    } else {
      _typeof = function _typeof(obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn) {
    var module = { exports: {} };
  	return fn(module, module.exports), module.exports;
  }

  function commonjsRequire (path) {
  	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
  }

  var runtime_1 = createCommonjsModule(function (module) {
    var runtime = function (exports) {

      var Op = Object.prototype;
      var hasOwn = Op.hasOwnProperty;
      var undefined$1; // More compressible than void 0.

      var $Symbol = typeof Symbol === "function" ? Symbol : {};
      var iteratorSymbol = $Symbol.iterator || "@@iterator";
      var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
      var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

      function define(obj, key, value) {
        Object.defineProperty(obj, key, {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
        return obj[key];
      }

      try {
        // IE 8 has a broken Object.defineProperty that only works on DOM objects.
        define({}, "");
      } catch (err) {
        define = function define(obj, key, value) {
          return obj[key] = value;
        };
      }

      function wrap(innerFn, outerFn, self, tryLocsList) {
        // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
        var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
        var generator = Object.create(protoGenerator.prototype);
        var context = new Context(tryLocsList || []); // The ._invoke method unifies the implementations of the .next,
        // .throw, and .return methods.

        generator._invoke = makeInvokeMethod(innerFn, self, context);
        return generator;
      }

      exports.wrap = wrap; // Try/catch helper to minimize deoptimizations. Returns a completion
      // record like context.tryEntries[i].completion. This interface could
      // have been (and was previously) designed to take a closure to be
      // invoked without arguments, but in all the cases we care about we
      // already have an existing method we want to call, so there's no need
      // to create a new function object. We can even get away with assuming
      // the method takes exactly one argument, since that happens to be true
      // in every case, so we don't have to touch the arguments object. The
      // only additional allocation required is the completion record, which
      // has a stable shape and so hopefully should be cheap to allocate.

      function tryCatch(fn, obj, arg) {
        try {
          return {
            type: "normal",
            arg: fn.call(obj, arg)
          };
        } catch (err) {
          return {
            type: "throw",
            arg: err
          };
        }
      }

      var GenStateSuspendedStart = "suspendedStart";
      var GenStateSuspendedYield = "suspendedYield";
      var GenStateExecuting = "executing";
      var GenStateCompleted = "completed"; // Returning this object from the innerFn has the same effect as
      // breaking out of the dispatch switch statement.

      var ContinueSentinel = {}; // Dummy constructor functions that we use as the .constructor and
      // .constructor.prototype properties for functions that return Generator
      // objects. For full spec compliance, you may wish to configure your
      // minifier not to mangle the names of these two functions.

      function Generator() {}

      function GeneratorFunction() {}

      function GeneratorFunctionPrototype() {} // This is a polyfill for %IteratorPrototype% for environments that
      // don't natively support it.


      var IteratorPrototype = {};

      IteratorPrototype[iteratorSymbol] = function () {
        return this;
      };

      var getProto = Object.getPrototypeOf;
      var NativeIteratorPrototype = getProto && getProto(getProto(values([])));

      if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
        // This environment has a native %IteratorPrototype%; use it instead
        // of the polyfill.
        IteratorPrototype = NativeIteratorPrototype;
      }

      var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
      GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
      GeneratorFunctionPrototype.constructor = GeneratorFunction;
      GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"); // Helper for defining the .next, .throw, and .return methods of the
      // Iterator interface in terms of a single ._invoke method.

      function defineIteratorMethods(prototype) {
        ["next", "throw", "return"].forEach(function (method) {
          define(prototype, method, function (arg) {
            return this._invoke(method, arg);
          });
        });
      }

      exports.isGeneratorFunction = function (genFun) {
        var ctor = typeof genFun === "function" && genFun.constructor;
        return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
      };

      exports.mark = function (genFun) {
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
        } else {
          genFun.__proto__ = GeneratorFunctionPrototype;
          define(genFun, toStringTagSymbol, "GeneratorFunction");
        }

        genFun.prototype = Object.create(Gp);
        return genFun;
      }; // Within the body of any async function, `await x` is transformed to
      // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
      // `hasOwn.call(value, "__await")` to determine if the yielded value is
      // meant to be awaited.


      exports.awrap = function (arg) {
        return {
          __await: arg
        };
      };

      function AsyncIterator(generator, PromiseImpl) {
        function invoke(method, arg, resolve, reject) {
          var record = tryCatch(generator[method], generator, arg);

          if (record.type === "throw") {
            reject(record.arg);
          } else {
            var result = record.arg;
            var value = result.value;

            if (value && _typeof(value) === "object" && hasOwn.call(value, "__await")) {
              return PromiseImpl.resolve(value.__await).then(function (value) {
                invoke("next", value, resolve, reject);
              }, function (err) {
                invoke("throw", err, resolve, reject);
              });
            }

            return PromiseImpl.resolve(value).then(function (unwrapped) {
              // When a yielded Promise is resolved, its final value becomes
              // the .value of the Promise<{value,done}> result for the
              // current iteration.
              result.value = unwrapped;
              resolve(result);
            }, function (error) {
              // If a rejected Promise was yielded, throw the rejection back
              // into the async generator function so it can be handled there.
              return invoke("throw", error, resolve, reject);
            });
          }
        }

        var previousPromise;

        function enqueue(method, arg) {
          function callInvokeWithMethodAndArg() {
            return new PromiseImpl(function (resolve, reject) {
              invoke(method, arg, resolve, reject);
            });
          }

          return previousPromise = // If enqueue has been called before, then we want to wait until
          // all previous Promises have been resolved before calling invoke,
          // so that results are always delivered in the correct order. If
          // enqueue has not been called before, then it is important to
          // call invoke immediately, without waiting on a callback to fire,
          // so that the async generator function has the opportunity to do
          // any necessary setup in a predictable way. This predictability
          // is why the Promise constructor synchronously invokes its
          // executor callback, and why async functions synchronously
          // execute code before the first await. Since we implement simple
          // async functions in terms of async generators, it is especially
          // important to get this right, even though it requires care.
          previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
        } // Define the unified helper method that is used to implement .next,
        // .throw, and .return (see defineIteratorMethods).


        this._invoke = enqueue;
      }

      defineIteratorMethods(AsyncIterator.prototype);

      AsyncIterator.prototype[asyncIteratorSymbol] = function () {
        return this;
      };

      exports.AsyncIterator = AsyncIterator; // Note that simple async functions are implemented on top of
      // AsyncIterator objects; they just return a Promise for the value of
      // the final result produced by the iterator.

      exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
        if (PromiseImpl === void 0) PromiseImpl = Promise;
        var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
        return exports.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
        : iter.next().then(function (result) {
          return result.done ? result.value : iter.next();
        });
      };

      function makeInvokeMethod(innerFn, self, context) {
        var state = GenStateSuspendedStart;
        return function invoke(method, arg) {
          if (state === GenStateExecuting) {
            throw new Error("Generator is already running");
          }

          if (state === GenStateCompleted) {
            if (method === "throw") {
              throw arg;
            } // Be forgiving, per 25.3.3.3.3 of the spec:
            // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume


            return doneResult();
          }

          context.method = method;
          context.arg = arg;

          while (true) {
            var delegate = context.delegate;

            if (delegate) {
              var delegateResult = maybeInvokeDelegate(delegate, context);

              if (delegateResult) {
                if (delegateResult === ContinueSentinel) continue;
                return delegateResult;
              }
            }

            if (context.method === "next") {
              // Setting context._sent for legacy support of Babel's
              // function.sent implementation.
              context.sent = context._sent = context.arg;
            } else if (context.method === "throw") {
              if (state === GenStateSuspendedStart) {
                state = GenStateCompleted;
                throw context.arg;
              }

              context.dispatchException(context.arg);
            } else if (context.method === "return") {
              context.abrupt("return", context.arg);
            }

            state = GenStateExecuting;
            var record = tryCatch(innerFn, self, context);

            if (record.type === "normal") {
              // If an exception is thrown from innerFn, we leave state ===
              // GenStateExecuting and loop back for another invocation.
              state = context.done ? GenStateCompleted : GenStateSuspendedYield;

              if (record.arg === ContinueSentinel) {
                continue;
              }

              return {
                value: record.arg,
                done: context.done
              };
            } else if (record.type === "throw") {
              state = GenStateCompleted; // Dispatch the exception by looping back around to the
              // context.dispatchException(context.arg) call above.

              context.method = "throw";
              context.arg = record.arg;
            }
          }
        };
      } // Call delegate.iterator[context.method](context.arg) and handle the
      // result, either by returning a { value, done } result from the
      // delegate iterator, or by modifying context.method and context.arg,
      // setting context.delegate to null, and returning the ContinueSentinel.


      function maybeInvokeDelegate(delegate, context) {
        var method = delegate.iterator[context.method];

        if (method === undefined$1) {
          // A .throw or .return when the delegate iterator has no .throw
          // method always terminates the yield* loop.
          context.delegate = null;

          if (context.method === "throw") {
            // Note: ["return"] must be used for ES3 parsing compatibility.
            if (delegate.iterator["return"]) {
              // If the delegate iterator has a return method, give it a
              // chance to clean up.
              context.method = "return";
              context.arg = undefined$1;
              maybeInvokeDelegate(delegate, context);

              if (context.method === "throw") {
                // If maybeInvokeDelegate(context) changed context.method from
                // "return" to "throw", let that override the TypeError below.
                return ContinueSentinel;
              }
            }

            context.method = "throw";
            context.arg = new TypeError("The iterator does not provide a 'throw' method");
          }

          return ContinueSentinel;
        }

        var record = tryCatch(method, delegate.iterator, context.arg);

        if (record.type === "throw") {
          context.method = "throw";
          context.arg = record.arg;
          context.delegate = null;
          return ContinueSentinel;
        }

        var info = record.arg;

        if (!info) {
          context.method = "throw";
          context.arg = new TypeError("iterator result is not an object");
          context.delegate = null;
          return ContinueSentinel;
        }

        if (info.done) {
          // Assign the result of the finished delegate to the temporary
          // variable specified by delegate.resultName (see delegateYield).
          context[delegate.resultName] = info.value; // Resume execution at the desired location (see delegateYield).

          context.next = delegate.nextLoc; // If context.method was "throw" but the delegate handled the
          // exception, let the outer generator proceed normally. If
          // context.method was "next", forget context.arg since it has been
          // "consumed" by the delegate iterator. If context.method was
          // "return", allow the original .return call to continue in the
          // outer generator.

          if (context.method !== "return") {
            context.method = "next";
            context.arg = undefined$1;
          }
        } else {
          // Re-yield the result returned by the delegate method.
          return info;
        } // The delegate iterator is finished, so forget it and continue with
        // the outer generator.


        context.delegate = null;
        return ContinueSentinel;
      } // Define Generator.prototype.{next,throw,return} in terms of the
      // unified ._invoke helper method.


      defineIteratorMethods(Gp);
      define(Gp, toStringTagSymbol, "Generator"); // A Generator should always return itself as the iterator object when the
      // @@iterator function is called on it. Some browsers' implementations of the
      // iterator prototype chain incorrectly implement this, causing the Generator
      // object to not be returned from this call. This ensures that doesn't happen.
      // See https://github.com/facebook/regenerator/issues/274 for more details.

      Gp[iteratorSymbol] = function () {
        return this;
      };

      Gp.toString = function () {
        return "[object Generator]";
      };

      function pushTryEntry(locs) {
        var entry = {
          tryLoc: locs[0]
        };

        if (1 in locs) {
          entry.catchLoc = locs[1];
        }

        if (2 in locs) {
          entry.finallyLoc = locs[2];
          entry.afterLoc = locs[3];
        }

        this.tryEntries.push(entry);
      }

      function resetTryEntry(entry) {
        var record = entry.completion || {};
        record.type = "normal";
        delete record.arg;
        entry.completion = record;
      }

      function Context(tryLocsList) {
        // The root entry object (effectively a try statement without a catch
        // or a finally block) gives us a place to store values thrown from
        // locations where there is no enclosing try statement.
        this.tryEntries = [{
          tryLoc: "root"
        }];
        tryLocsList.forEach(pushTryEntry, this);
        this.reset(true);
      }

      exports.keys = function (object) {
        var keys = [];

        for (var key in object) {
          keys.push(key);
        }

        keys.reverse(); // Rather than returning an object with a next method, we keep
        // things simple and return the next function itself.

        return function next() {
          while (keys.length) {
            var key = keys.pop();

            if (key in object) {
              next.value = key;
              next.done = false;
              return next;
            }
          } // To avoid creating an additional object, we just hang the .value
          // and .done properties off the next function object itself. This
          // also ensures that the minifier will not anonymize the function.


          next.done = true;
          return next;
        };
      };

      function values(iterable) {
        if (iterable) {
          var iteratorMethod = iterable[iteratorSymbol];

          if (iteratorMethod) {
            return iteratorMethod.call(iterable);
          }

          if (typeof iterable.next === "function") {
            return iterable;
          }

          if (!isNaN(iterable.length)) {
            var i = -1,
                next = function next() {
              while (++i < iterable.length) {
                if (hasOwn.call(iterable, i)) {
                  next.value = iterable[i];
                  next.done = false;
                  return next;
                }
              }

              next.value = undefined$1;
              next.done = true;
              return next;
            };

            return next.next = next;
          }
        } // Return an iterator with no values.


        return {
          next: doneResult
        };
      }

      exports.values = values;

      function doneResult() {
        return {
          value: undefined$1,
          done: true
        };
      }

      Context.prototype = {
        constructor: Context,
        reset: function reset(skipTempReset) {
          this.prev = 0;
          this.next = 0; // Resetting context._sent for legacy support of Babel's
          // function.sent implementation.

          this.sent = this._sent = undefined$1;
          this.done = false;
          this.delegate = null;
          this.method = "next";
          this.arg = undefined$1;
          this.tryEntries.forEach(resetTryEntry);

          if (!skipTempReset) {
            for (var name in this) {
              // Not sure about the optimal order of these conditions:
              if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                this[name] = undefined$1;
              }
            }
          }
        },
        stop: function stop() {
          this.done = true;
          var rootEntry = this.tryEntries[0];
          var rootRecord = rootEntry.completion;

          if (rootRecord.type === "throw") {
            throw rootRecord.arg;
          }

          return this.rval;
        },
        dispatchException: function dispatchException(exception) {
          if (this.done) {
            throw exception;
          }

          var context = this;

          function handle(loc, caught) {
            record.type = "throw";
            record.arg = exception;
            context.next = loc;

            if (caught) {
              // If the dispatched exception was caught by a catch block,
              // then let that catch block handle the exception normally.
              context.method = "next";
              context.arg = undefined$1;
            }

            return !!caught;
          }

          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            var record = entry.completion;

            if (entry.tryLoc === "root") {
              // Exception thrown outside of any try block that could handle
              // it, so set the completion value of the entire function to
              // throw the exception.
              return handle("end");
            }

            if (entry.tryLoc <= this.prev) {
              var hasCatch = hasOwn.call(entry, "catchLoc");
              var hasFinally = hasOwn.call(entry, "finallyLoc");

              if (hasCatch && hasFinally) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                } else if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else if (hasCatch) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                }
              } else if (hasFinally) {
                if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else {
                throw new Error("try statement without catch or finally");
              }
            }
          }
        },
        abrupt: function abrupt(type, arg) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];

            if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
              var finallyEntry = entry;
              break;
            }
          }

          if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
            // Ignore the finally entry if control is not jumping to a
            // location outside the try/catch block.
            finallyEntry = null;
          }

          var record = finallyEntry ? finallyEntry.completion : {};
          record.type = type;
          record.arg = arg;

          if (finallyEntry) {
            this.method = "next";
            this.next = finallyEntry.finallyLoc;
            return ContinueSentinel;
          }

          return this.complete(record);
        },
        complete: function complete(record, afterLoc) {
          if (record.type === "throw") {
            throw record.arg;
          }

          if (record.type === "break" || record.type === "continue") {
            this.next = record.arg;
          } else if (record.type === "return") {
            this.rval = this.arg = record.arg;
            this.method = "return";
            this.next = "end";
          } else if (record.type === "normal" && afterLoc) {
            this.next = afterLoc;
          }

          return ContinueSentinel;
        },
        finish: function finish(finallyLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];

            if (entry.finallyLoc === finallyLoc) {
              this.complete(entry.completion, entry.afterLoc);
              resetTryEntry(entry);
              return ContinueSentinel;
            }
          }
        },
        "catch": function _catch(tryLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];

            if (entry.tryLoc === tryLoc) {
              var record = entry.completion;

              if (record.type === "throw") {
                var thrown = record.arg;
                resetTryEntry(entry);
              }

              return thrown;
            }
          } // The context.catch method must only be called with a location
          // argument that corresponds to a known catch block.


          throw new Error("illegal catch attempt");
        },
        delegateYield: function delegateYield(iterable, resultName, nextLoc) {
          this.delegate = {
            iterator: values(iterable),
            resultName: resultName,
            nextLoc: nextLoc
          };

          if (this.method === "next") {
            // Deliberately forget the last sent value so that we don't
            // accidentally pass it on to the delegate.
            this.arg = undefined$1;
          }

          return ContinueSentinel;
        }
      }; // Regardless of whether this script is executing as a CommonJS module
      // or not, return the runtime object so that we can declare the variable
      // regeneratorRuntime in the outer scope, which allows this module to be
      // injected easily by `bin/regenerator --include-runtime script.js`.

      return exports;
    }( // If this script is executing as a CommonJS module, use module.exports
    // as the regeneratorRuntime namespace. Otherwise create a new empty
    // object. Either way, the resulting object will be used to initialize
    // the regeneratorRuntime variable at the top of this file.
    module.exports );

    try {
      regeneratorRuntime = runtime;
    } catch (accidentalStrictMode) {
      // This module should not be running in strict mode, so the above
      // assignment should always work unless something is misconfigured. Just
      // in case runtime.js accidentally runs in strict mode, we can escape
      // strict mode using a global Function call. This could conceivably fail
      // if a Content Security Policy forbids using Function, but in that case
      // the proper solution is to fix the accidental strict mode problem. If
      // you've misconfigured your bundler to force strict mode and applied a
      // CSP to forbid Function, and you're not willing to fix either of those
      // problems, please detail your unique predicament in a GitHub issue.
      Function("r", "regeneratorRuntime = r")(runtime);
    }
  });

  var regenerator = runtime_1;

  /**
   * Checks if `value` is classified as an `Array` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an array, else `false`.
   * @example
   *
   * _.isArray([1, 2, 3]);
   * // => true
   *
   * _.isArray(document.body.children);
   * // => false
   *
   * _.isArray('abc');
   * // => false
   *
   * _.isArray(_.noop);
   * // => false
   */
  var isArray = Array.isArray;
  var isArray_1 = isArray;

  var freeGlobal = _typeof(commonjsGlobal) == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  var _freeGlobal = freeGlobal;

  /** Detect free variable `self`. */

  var freeSelf = (typeof self === "undefined" ? "undefined" : _typeof(self)) == 'object' && self && self.Object === Object && self;
  /** Used as a reference to the global object. */

  var root = _freeGlobal || freeSelf || Function('return this')();
  var _root = root;

  /** Built-in value references. */

  var _Symbol2 = _root.Symbol;
  var _Symbol = _Symbol2;

  /** Used for built-in method references. */

  var objectProto$f = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$c = objectProto$f.hasOwnProperty;
  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */

  var nativeObjectToString$1 = objectProto$f.toString;
  /** Built-in value references. */

  var symToStringTag$1 = _Symbol ? _Symbol.toStringTag : undefined;
  /**
   * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the raw `toStringTag`.
   */

  function getRawTag(value) {
    var isOwn = hasOwnProperty$c.call(value, symToStringTag$1),
        tag = value[symToStringTag$1];

    try {
      value[symToStringTag$1] = undefined;
      var unmasked = true;
    } catch (e) {}

    var result = nativeObjectToString$1.call(value);

    if (unmasked) {
      if (isOwn) {
        value[symToStringTag$1] = tag;
      } else {
        delete value[symToStringTag$1];
      }
    }

    return result;
  }

  var _getRawTag = getRawTag;

  /** Used for built-in method references. */
  var objectProto$e = Object.prototype;
  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */

  var nativeObjectToString = objectProto$e.toString;
  /**
   * Converts `value` to a string using `Object.prototype.toString`.
   *
   * @private
   * @param {*} value The value to convert.
   * @returns {string} Returns the converted string.
   */

  function objectToString(value) {
    return nativeObjectToString.call(value);
  }

  var _objectToString = objectToString;

  /** `Object#toString` result references. */

  var nullTag = '[object Null]',
      undefinedTag = '[object Undefined]';
  /** Built-in value references. */

  var symToStringTag = _Symbol ? _Symbol.toStringTag : undefined;
  /**
   * The base implementation of `getTag` without fallbacks for buggy environments.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */

  function baseGetTag(value) {
    if (value == null) {
      return value === undefined ? undefinedTag : nullTag;
    }

    return symToStringTag && symToStringTag in Object(value) ? _getRawTag(value) : _objectToString(value);
  }

  var _baseGetTag = baseGetTag;

  /**
   * Checks if `value` is object-like. A value is object-like if it's not `null`
   * and has a `typeof` result of "object".
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   * @example
   *
   * _.isObjectLike({});
   * // => true
   *
   * _.isObjectLike([1, 2, 3]);
   * // => true
   *
   * _.isObjectLike(_.noop);
   * // => false
   *
   * _.isObjectLike(null);
   * // => false
   */
  function isObjectLike(value) {
    return value != null && _typeof(value) == 'object';
  }

  var isObjectLike_1 = isObjectLike;

  /** `Object#toString` result references. */

  var symbolTag$3 = '[object Symbol]';
  /**
   * Checks if `value` is classified as a `Symbol` primitive or object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
   * @example
   *
   * _.isSymbol(Symbol.iterator);
   * // => true
   *
   * _.isSymbol('abc');
   * // => false
   */

  function isSymbol(value) {
    return _typeof(value) == 'symbol' || isObjectLike_1(value) && _baseGetTag(value) == symbolTag$3;
  }

  var isSymbol_1 = isSymbol;

  /** Used to match property names within property paths. */

  var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
      reIsPlainProp = /^\w*$/;
  /**
   * Checks if `value` is a property name and not a property path.
   *
   * @private
   * @param {*} value The value to check.
   * @param {Object} [object] The object to query keys on.
   * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
   */

  function isKey(value, object) {
    if (isArray_1(value)) {
      return false;
    }

    var type = _typeof(value);

    if (type == 'number' || type == 'symbol' || type == 'boolean' || value == null || isSymbol_1(value)) {
      return true;
    }

    return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
  }

  var _isKey = isKey;

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */
  function isObject(value) {
    var type = _typeof(value);

    return value != null && (type == 'object' || type == 'function');
  }

  var isObject_1 = isObject;

  /** `Object#toString` result references. */

  var asyncTag = '[object AsyncFunction]',
      funcTag$2 = '[object Function]',
      genTag$1 = '[object GeneratorFunction]',
      proxyTag = '[object Proxy]';
  /**
   * Checks if `value` is classified as a `Function` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   *
   * _.isFunction(/abc/);
   * // => false
   */

  function isFunction(value) {
    if (!isObject_1(value)) {
      return false;
    } // The use of `Object#toString` avoids issues with the `typeof` operator
    // in Safari 9 which returns 'object' for typed arrays and other constructors.


    var tag = _baseGetTag(value);
    return tag == funcTag$2 || tag == genTag$1 || tag == asyncTag || tag == proxyTag;
  }

  var isFunction_1 = isFunction;

  /** Used to detect overreaching core-js shims. */

  var coreJsData = _root['__core-js_shared__'];
  var _coreJsData = coreJsData;

  /** Used to detect methods masquerading as native. */

  var maskSrcKey = function () {
    var uid = /[^.]+$/.exec(_coreJsData && _coreJsData.keys && _coreJsData.keys.IE_PROTO || '');
    return uid ? 'Symbol(src)_1.' + uid : '';
  }();
  /**
   * Checks if `func` has its source masked.
   *
   * @private
   * @param {Function} func The function to check.
   * @returns {boolean} Returns `true` if `func` is masked, else `false`.
   */


  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }

  var _isMasked = isMasked;

  /** Used for built-in method references. */
  var funcProto$2 = Function.prototype;
  /** Used to resolve the decompiled source of functions. */

  var funcToString$2 = funcProto$2.toString;
  /**
   * Converts `func` to its source code.
   *
   * @private
   * @param {Function} func The function to convert.
   * @returns {string} Returns the source code.
   */

  function toSource(func) {
    if (func != null) {
      try {
        return funcToString$2.call(func);
      } catch (e) {}

      try {
        return func + '';
      } catch (e) {}
    }

    return '';
  }

  var _toSource = toSource;

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */

  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  /** Used to detect host constructors (Safari). */

  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  /** Used for built-in method references. */

  var funcProto$1 = Function.prototype,
      objectProto$d = Object.prototype;
  /** Used to resolve the decompiled source of functions. */

  var funcToString$1 = funcProto$1.toString;
  /** Used to check objects for own properties. */

  var hasOwnProperty$b = objectProto$d.hasOwnProperty;
  /** Used to detect if a method is native. */

  var reIsNative = RegExp('^' + funcToString$1.call(hasOwnProperty$b).replace(reRegExpChar, '\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
  /**
   * The base implementation of `_.isNative` without bad shim checks.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a native function,
   *  else `false`.
   */

  function baseIsNative(value) {
    if (!isObject_1(value) || _isMasked(value)) {
      return false;
    }

    var pattern = isFunction_1(value) ? reIsNative : reIsHostCtor;
    return pattern.test(_toSource(value));
  }

  var _baseIsNative = baseIsNative;

  /**
   * Gets the value at `key` of `object`.
   *
   * @private
   * @param {Object} [object] The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */
  function getValue(object, key) {
    return object == null ? undefined : object[key];
  }

  var _getValue = getValue;

  /**
   * Gets the native function at `key` of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the method to get.
   * @returns {*} Returns the function if it's native, else `undefined`.
   */

  function getNative(object, key) {
    var value = _getValue(object, key);
    return _baseIsNative(value) ? value : undefined;
  }

  var _getNative = getNative;

  /* Built-in method references that are verified to be native. */

  var nativeCreate = _getNative(Object, 'create');
  var _nativeCreate = nativeCreate;

  /**
   * Removes all key-value entries from the hash.
   *
   * @private
   * @name clear
   * @memberOf Hash
   */

  function hashClear() {
    this.__data__ = _nativeCreate ? _nativeCreate(null) : {};
    this.size = 0;
  }

  var _hashClear = hashClear;

  /**
   * Removes `key` and its value from the hash.
   *
   * @private
   * @name delete
   * @memberOf Hash
   * @param {Object} hash The hash to modify.
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }

  var _hashDelete = hashDelete;

  /** Used to stand-in for `undefined` hash values. */

  var HASH_UNDEFINED$2 = '__lodash_hash_undefined__';
  /** Used for built-in method references. */

  var objectProto$c = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$a = objectProto$c.hasOwnProperty;
  /**
   * Gets the hash value for `key`.
   *
   * @private
   * @name get
   * @memberOf Hash
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */

  function hashGet(key) {
    var data = this.__data__;

    if (_nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED$2 ? undefined : result;
    }

    return hasOwnProperty$a.call(data, key) ? data[key] : undefined;
  }

  var _hashGet = hashGet;

  /** Used for built-in method references. */

  var objectProto$b = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$9 = objectProto$b.hasOwnProperty;
  /**
   * Checks if a hash value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Hash
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */

  function hashHas(key) {
    var data = this.__data__;
    return _nativeCreate ? data[key] !== undefined : hasOwnProperty$9.call(data, key);
  }

  var _hashHas = hashHas;

  /** Used to stand-in for `undefined` hash values. */

  var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';
  /**
   * Sets the hash `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf Hash
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the hash instance.
   */

  function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = _nativeCreate && value === undefined ? HASH_UNDEFINED$1 : value;
    return this;
  }

  var _hashSet = hashSet;

  /**
   * Creates a hash object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */

  function Hash(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;
    this.clear();

    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  } // Add methods to `Hash`.


  Hash.prototype.clear = _hashClear;
  Hash.prototype['delete'] = _hashDelete;
  Hash.prototype.get = _hashGet;
  Hash.prototype.has = _hashHas;
  Hash.prototype.set = _hashSet;
  var _Hash = Hash;

  /**
   * Removes all key-value entries from the list cache.
   *
   * @private
   * @name clear
   * @memberOf ListCache
   */
  function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
  }

  var _listCacheClear = listCacheClear;

  /**
   * Performs a
   * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
   * comparison between two values to determine if they are equivalent.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to compare.
   * @param {*} other The other value to compare.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   * @example
   *
   * var object = { 'a': 1 };
   * var other = { 'a': 1 };
   *
   * _.eq(object, object);
   * // => true
   *
   * _.eq(object, other);
   * // => false
   *
   * _.eq('a', 'a');
   * // => true
   *
   * _.eq('a', Object('a'));
   * // => false
   *
   * _.eq(NaN, NaN);
   * // => true
   */
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }

  var eq_1 = eq;

  /**
   * Gets the index at which the `key` is found in `array` of key-value pairs.
   *
   * @private
   * @param {Array} array The array to inspect.
   * @param {*} key The key to search for.
   * @returns {number} Returns the index of the matched value, else `-1`.
   */

  function assocIndexOf(array, key) {
    var length = array.length;

    while (length--) {
      if (eq_1(array[length][0], key)) {
        return length;
      }
    }

    return -1;
  }

  var _assocIndexOf = assocIndexOf;

  /** Used for built-in method references. */

  var arrayProto = Array.prototype;
  /** Built-in value references. */

  var splice = arrayProto.splice;
  /**
   * Removes `key` and its value from the list cache.
   *
   * @private
   * @name delete
   * @memberOf ListCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */

  function listCacheDelete(key) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);

    if (index < 0) {
      return false;
    }

    var lastIndex = data.length - 1;

    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }

    --this.size;
    return true;
  }

  var _listCacheDelete = listCacheDelete;

  /**
   * Gets the list cache value for `key`.
   *
   * @private
   * @name get
   * @memberOf ListCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */

  function listCacheGet(key) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);
    return index < 0 ? undefined : data[index][1];
  }

  var _listCacheGet = listCacheGet;

  /**
   * Checks if a list cache value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf ListCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */

  function listCacheHas(key) {
    return _assocIndexOf(this.__data__, key) > -1;
  }

  var _listCacheHas = listCacheHas;

  /**
   * Sets the list cache `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf ListCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the list cache instance.
   */

  function listCacheSet(key, value) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);

    if (index < 0) {
      ++this.size;
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }

    return this;
  }

  var _listCacheSet = listCacheSet;

  /**
   * Creates an list cache object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */

  function ListCache(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;
    this.clear();

    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  } // Add methods to `ListCache`.


  ListCache.prototype.clear = _listCacheClear;
  ListCache.prototype['delete'] = _listCacheDelete;
  ListCache.prototype.get = _listCacheGet;
  ListCache.prototype.has = _listCacheHas;
  ListCache.prototype.set = _listCacheSet;
  var _ListCache = ListCache;

  /* Built-in method references that are verified to be native. */

  var Map = _getNative(_root, 'Map');
  var _Map = Map;

  /**
   * Removes all key-value entries from the map.
   *
   * @private
   * @name clear
   * @memberOf MapCache
   */

  function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
      'hash': new _Hash(),
      'map': new (_Map || _ListCache)(),
      'string': new _Hash()
    };
  }

  var _mapCacheClear = mapCacheClear;

  /**
   * Checks if `value` is suitable for use as unique object key.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
   */
  function isKeyable(value) {
    var type = _typeof(value);

    return type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean' ? value !== '__proto__' : value === null;
  }

  var _isKeyable = isKeyable;

  /**
   * Gets the data for `map`.
   *
   * @private
   * @param {Object} map The map to query.
   * @param {string} key The reference key.
   * @returns {*} Returns the map data.
   */

  function getMapData(map, key) {
    var data = map.__data__;
    return _isKeyable(key) ? data[typeof key == 'string' ? 'string' : 'hash'] : data.map;
  }

  var _getMapData = getMapData;

  /**
   * Removes `key` and its value from the map.
   *
   * @private
   * @name delete
   * @memberOf MapCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */

  function mapCacheDelete(key) {
    var result = _getMapData(this, key)['delete'](key);
    this.size -= result ? 1 : 0;
    return result;
  }

  var _mapCacheDelete = mapCacheDelete;

  /**
   * Gets the map value for `key`.
   *
   * @private
   * @name get
   * @memberOf MapCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */

  function mapCacheGet(key) {
    return _getMapData(this, key).get(key);
  }

  var _mapCacheGet = mapCacheGet;

  /**
   * Checks if a map value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf MapCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */

  function mapCacheHas(key) {
    return _getMapData(this, key).has(key);
  }

  var _mapCacheHas = mapCacheHas;

  /**
   * Sets the map `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf MapCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the map cache instance.
   */

  function mapCacheSet(key, value) {
    var data = _getMapData(this, key),
        size = data.size;
    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }

  var _mapCacheSet = mapCacheSet;

  /**
   * Creates a map cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */

  function MapCache(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;
    this.clear();

    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  } // Add methods to `MapCache`.


  MapCache.prototype.clear = _mapCacheClear;
  MapCache.prototype['delete'] = _mapCacheDelete;
  MapCache.prototype.get = _mapCacheGet;
  MapCache.prototype.has = _mapCacheHas;
  MapCache.prototype.set = _mapCacheSet;
  var _MapCache = MapCache;

  /** Error message constants. */

  var FUNC_ERROR_TEXT = 'Expected a function';
  /**
   * Creates a function that memoizes the result of `func`. If `resolver` is
   * provided, it determines the cache key for storing the result based on the
   * arguments provided to the memoized function. By default, the first argument
   * provided to the memoized function is used as the map cache key. The `func`
   * is invoked with the `this` binding of the memoized function.
   *
   * **Note:** The cache is exposed as the `cache` property on the memoized
   * function. Its creation may be customized by replacing the `_.memoize.Cache`
   * constructor with one whose instances implement the
   * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
   * method interface of `clear`, `delete`, `get`, `has`, and `set`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] The function to resolve the cache key.
   * @returns {Function} Returns the new memoized function.
   * @example
   *
   * var object = { 'a': 1, 'b': 2 };
   * var other = { 'c': 3, 'd': 4 };
   *
   * var values = _.memoize(_.values);
   * values(object);
   * // => [1, 2]
   *
   * values(other);
   * // => [3, 4]
   *
   * object.a = 2;
   * values(object);
   * // => [1, 2]
   *
   * // Modify the result cache.
   * values.cache.set(object, ['a', 'b']);
   * values(object);
   * // => ['a', 'b']
   *
   * // Replace `_.memoize.Cache`.
   * _.memoize.Cache = WeakMap;
   */

  function memoize(func, resolver) {
    if (typeof func != 'function' || resolver != null && typeof resolver != 'function') {
      throw new TypeError(FUNC_ERROR_TEXT);
    }

    var memoized = function memoized() {
      var args = arguments,
          key = resolver ? resolver.apply(this, args) : args[0],
          cache = memoized.cache;

      if (cache.has(key)) {
        return cache.get(key);
      }

      var result = func.apply(this, args);
      memoized.cache = cache.set(key, result) || cache;
      return result;
    };

    memoized.cache = new (memoize.Cache || _MapCache)();
    return memoized;
  } // Expose `MapCache`.


  memoize.Cache = _MapCache;
  var memoize_1 = memoize;

  /** Used as the maximum memoize cache size. */

  var MAX_MEMOIZE_SIZE = 500;
  /**
   * A specialized version of `_.memoize` which clears the memoized function's
   * cache when it exceeds `MAX_MEMOIZE_SIZE`.
   *
   * @private
   * @param {Function} func The function to have its output memoized.
   * @returns {Function} Returns the new memoized function.
   */

  function memoizeCapped(func) {
    var result = memoize_1(func, function (key) {
      if (cache.size === MAX_MEMOIZE_SIZE) {
        cache.clear();
      }

      return key;
    });
    var cache = result.cache;
    return result;
  }

  var _memoizeCapped = memoizeCapped;

  /** Used to match property names within property paths. */

  var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
  /** Used to match backslashes in property paths. */

  var reEscapeChar = /\\(\\)?/g;
  /**
   * Converts `string` to a property path array.
   *
   * @private
   * @param {string} string The string to convert.
   * @returns {Array} Returns the property path array.
   */

  var stringToPath = _memoizeCapped(function (string) {
    var result = [];

    if (string.charCodeAt(0) === 46
    /* . */
    ) {
        result.push('');
      }

    string.replace(rePropName, function (match, number, quote, subString) {
      result.push(quote ? subString.replace(reEscapeChar, '$1') : number || match);
    });
    return result;
  });
  var _stringToPath = stringToPath;

  /**
   * A specialized version of `_.map` for arrays without support for iteratee
   * shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the new mapped array.
   */
  function arrayMap(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length,
        result = Array(length);

    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }

    return result;
  }

  var _arrayMap = arrayMap;

  /** Used as references for various `Number` constants. */

  var INFINITY$2 = 1 / 0;
  /** Used to convert symbols to primitives and strings. */

  var symbolProto$2 = _Symbol ? _Symbol.prototype : undefined,
      symbolToString = symbolProto$2 ? symbolProto$2.toString : undefined;
  /**
   * The base implementation of `_.toString` which doesn't convert nullish
   * values to empty strings.
   *
   * @private
   * @param {*} value The value to process.
   * @returns {string} Returns the string.
   */

  function baseToString(value) {
    // Exit early for strings to avoid a performance hit in some environments.
    if (typeof value == 'string') {
      return value;
    }

    if (isArray_1(value)) {
      // Recursively convert values (susceptible to call stack limits).
      return _arrayMap(value, baseToString) + '';
    }

    if (isSymbol_1(value)) {
      return symbolToString ? symbolToString.call(value) : '';
    }

    var result = value + '';
    return result == '0' && 1 / value == -INFINITY$2 ? '-0' : result;
  }

  var _baseToString = baseToString;

  /**
   * Converts `value` to a string. An empty string is returned for `null`
   * and `undefined` values. The sign of `-0` is preserved.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {string} Returns the converted string.
   * @example
   *
   * _.toString(null);
   * // => ''
   *
   * _.toString(-0);
   * // => '-0'
   *
   * _.toString([1, 2, 3]);
   * // => '1,2,3'
   */

  function toString(value) {
    return value == null ? '' : _baseToString(value);
  }

  var toString_1 = toString;

  /**
   * Casts `value` to a path array if it's not one.
   *
   * @private
   * @param {*} value The value to inspect.
   * @param {Object} [object] The object to query keys on.
   * @returns {Array} Returns the cast property path array.
   */

  function castPath(value, object) {
    if (isArray_1(value)) {
      return value;
    }

    return _isKey(value, object) ? [value] : _stringToPath(toString_1(value));
  }

  var _castPath = castPath;

  /** Used as references for various `Number` constants. */

  var INFINITY$1 = 1 / 0;
  /**
   * Converts `value` to a string key if it's not a string or symbol.
   *
   * @private
   * @param {*} value The value to inspect.
   * @returns {string|symbol} Returns the key.
   */

  function toKey(value) {
    if (typeof value == 'string' || isSymbol_1(value)) {
      return value;
    }

    var result = value + '';
    return result == '0' && 1 / value == -INFINITY$1 ? '-0' : result;
  }

  var _toKey = toKey;

  /**
   * The base implementation of `_.get` without support for default values.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to get.
   * @returns {*} Returns the resolved value.
   */

  function baseGet(object, path) {
    path = _castPath(path, object);
    var index = 0,
        length = path.length;

    while (object != null && index < length) {
      object = object[_toKey(path[index++])];
    }

    return index && index == length ? object : undefined;
  }

  var _baseGet = baseGet;

  /**
   * Gets the value at `path` of `object`. If the resolved value is
   * `undefined`, the `defaultValue` is returned in its place.
   *
   * @static
   * @memberOf _
   * @since 3.7.0
   * @category Object
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to get.
   * @param {*} [defaultValue] The value returned for `undefined` resolved values.
   * @returns {*} Returns the resolved value.
   * @example
   *
   * var object = { 'a': [{ 'b': { 'c': 3 } }] };
   *
   * _.get(object, 'a[0].b.c');
   * // => 3
   *
   * _.get(object, ['a', '0', 'b', 'c']);
   * // => 3
   *
   * _.get(object, 'a.b.c', 'default');
   * // => 'default'
   */

  function get(object, path, defaultValue) {
    var result = object == null ? undefined : _baseGet(object, path);
    return result === undefined ? defaultValue : result;
  }

  var get_1 = get;

  /**
   * Removes all key-value entries from the stack.
   *
   * @private
   * @name clear
   * @memberOf Stack
   */

  function stackClear() {
    this.__data__ = new _ListCache();
    this.size = 0;
  }

  var _stackClear = stackClear;

  /**
   * Removes `key` and its value from the stack.
   *
   * @private
   * @name delete
   * @memberOf Stack
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function stackDelete(key) {
    var data = this.__data__,
        result = data['delete'](key);
    this.size = data.size;
    return result;
  }

  var _stackDelete = stackDelete;

  /**
   * Gets the stack value for `key`.
   *
   * @private
   * @name get
   * @memberOf Stack
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function stackGet(key) {
    return this.__data__.get(key);
  }

  var _stackGet = stackGet;

  /**
   * Checks if a stack value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Stack
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function stackHas(key) {
    return this.__data__.has(key);
  }

  var _stackHas = stackHas;

  /** Used as the size to enable large array optimizations. */

  var LARGE_ARRAY_SIZE = 200;
  /**
   * Sets the stack `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf Stack
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the stack cache instance.
   */

  function stackSet(key, value) {
    var data = this.__data__;

    if (data instanceof _ListCache) {
      var pairs = data.__data__;

      if (!_Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
        pairs.push([key, value]);
        this.size = ++data.size;
        return this;
      }

      data = this.__data__ = new _MapCache(pairs);
    }

    data.set(key, value);
    this.size = data.size;
    return this;
  }

  var _stackSet = stackSet;

  /**
   * Creates a stack cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */

  function Stack(entries) {
    var data = this.__data__ = new _ListCache(entries);
    this.size = data.size;
  } // Add methods to `Stack`.


  Stack.prototype.clear = _stackClear;
  Stack.prototype['delete'] = _stackDelete;
  Stack.prototype.get = _stackGet;
  Stack.prototype.has = _stackHas;
  Stack.prototype.set = _stackSet;
  var _Stack = Stack;

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED = '__lodash_hash_undefined__';
  /**
   * Adds `value` to the array cache.
   *
   * @private
   * @name add
   * @memberOf SetCache
   * @alias push
   * @param {*} value The value to cache.
   * @returns {Object} Returns the cache instance.
   */

  function setCacheAdd(value) {
    this.__data__.set(value, HASH_UNDEFINED);

    return this;
  }

  var _setCacheAdd = setCacheAdd;

  /**
   * Checks if `value` is in the array cache.
   *
   * @private
   * @name has
   * @memberOf SetCache
   * @param {*} value The value to search for.
   * @returns {number} Returns `true` if `value` is found, else `false`.
   */
  function setCacheHas(value) {
    return this.__data__.has(value);
  }

  var _setCacheHas = setCacheHas;

  /**
   *
   * Creates an array cache object to store unique values.
   *
   * @private
   * @constructor
   * @param {Array} [values] The values to cache.
   */

  function SetCache(values) {
    var index = -1,
        length = values == null ? 0 : values.length;
    this.__data__ = new _MapCache();

    while (++index < length) {
      this.add(values[index]);
    }
  } // Add methods to `SetCache`.


  SetCache.prototype.add = SetCache.prototype.push = _setCacheAdd;
  SetCache.prototype.has = _setCacheHas;
  var _SetCache = SetCache;

  /**
   * A specialized version of `_.some` for arrays without support for iteratee
   * shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} predicate The function invoked per iteration.
   * @returns {boolean} Returns `true` if any element passes the predicate check,
   *  else `false`.
   */
  function arraySome(array, predicate) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return true;
      }
    }

    return false;
  }

  var _arraySome = arraySome;

  /**
   * Checks if a `cache` value for `key` exists.
   *
   * @private
   * @param {Object} cache The cache to query.
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function cacheHas(cache, key) {
    return cache.has(key);
  }

  var _cacheHas = cacheHas;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG$5 = 1,
      COMPARE_UNORDERED_FLAG$3 = 2;
  /**
   * A specialized version of `baseIsEqualDeep` for arrays with support for
   * partial deep comparisons.
   *
   * @private
   * @param {Array} array The array to compare.
   * @param {Array} other The other array to compare.
   * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
   * @param {Function} customizer The function to customize comparisons.
   * @param {Function} equalFunc The function to determine equivalents of values.
   * @param {Object} stack Tracks traversed `array` and `other` objects.
   * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
   */

  function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG$5,
        arrLength = array.length,
        othLength = other.length;

    if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
      return false;
    } // Check that cyclic values are equal.


    var arrStacked = stack.get(array);
    var othStacked = stack.get(other);

    if (arrStacked && othStacked) {
      return arrStacked == other && othStacked == array;
    }

    var index = -1,
        result = true,
        seen = bitmask & COMPARE_UNORDERED_FLAG$3 ? new _SetCache() : undefined;
    stack.set(array, other);
    stack.set(other, array); // Ignore non-index properties.

    while (++index < arrLength) {
      var arrValue = array[index],
          othValue = other[index];

      if (customizer) {
        var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
      }

      if (compared !== undefined) {
        if (compared) {
          continue;
        }

        result = false;
        break;
      } // Recursively compare arrays (susceptible to call stack limits).


      if (seen) {
        if (!_arraySome(other, function (othValue, othIndex) {
          if (!_cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
            return seen.push(othIndex);
          }
        })) {
          result = false;
          break;
        }
      } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
        result = false;
        break;
      }
    }

    stack['delete'](array);
    stack['delete'](other);
    return result;
  }

  var _equalArrays = equalArrays;

  /** Built-in value references. */

  var Uint8Array$1 = _root.Uint8Array;
  var _Uint8Array = Uint8Array$1;

  /**
   * Converts `map` to its key-value pairs.
   *
   * @private
   * @param {Object} map The map to convert.
   * @returns {Array} Returns the key-value pairs.
   */
  function mapToArray(map) {
    var index = -1,
        result = Array(map.size);
    map.forEach(function (value, key) {
      result[++index] = [key, value];
    });
    return result;
  }

  var _mapToArray = mapToArray;

  /**
   * Converts `set` to an array of its values.
   *
   * @private
   * @param {Object} set The set to convert.
   * @returns {Array} Returns the values.
   */
  function setToArray(set) {
    var index = -1,
        result = Array(set.size);
    set.forEach(function (value) {
      result[++index] = value;
    });
    return result;
  }

  var _setToArray = setToArray;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG$4 = 1,
      COMPARE_UNORDERED_FLAG$2 = 2;
  /** `Object#toString` result references. */

  var boolTag$4 = '[object Boolean]',
      dateTag$3 = '[object Date]',
      errorTag$3 = '[object Error]',
      mapTag$6 = '[object Map]',
      numberTag$3 = '[object Number]',
      regexpTag$3 = '[object RegExp]',
      setTag$6 = '[object Set]',
      stringTag$4 = '[object String]',
      symbolTag$2 = '[object Symbol]';
  var arrayBufferTag$3 = '[object ArrayBuffer]',
      dataViewTag$4 = '[object DataView]';
  /** Used to convert symbols to primitives and strings. */

  var symbolProto$1 = _Symbol ? _Symbol.prototype : undefined,
      symbolValueOf$1 = symbolProto$1 ? symbolProto$1.valueOf : undefined;
  /**
   * A specialized version of `baseIsEqualDeep` for comparing objects of
   * the same `toStringTag`.
   *
   * **Note:** This function only supports comparing values with tags of
   * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
   *
   * @private
   * @param {Object} object The object to compare.
   * @param {Object} other The other object to compare.
   * @param {string} tag The `toStringTag` of the objects to compare.
   * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
   * @param {Function} customizer The function to customize comparisons.
   * @param {Function} equalFunc The function to determine equivalents of values.
   * @param {Object} stack Tracks traversed `object` and `other` objects.
   * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
   */

  function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
    switch (tag) {
      case dataViewTag$4:
        if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
          return false;
        }

        object = object.buffer;
        other = other.buffer;

      case arrayBufferTag$3:
        if (object.byteLength != other.byteLength || !equalFunc(new _Uint8Array(object), new _Uint8Array(other))) {
          return false;
        }

        return true;

      case boolTag$4:
      case dateTag$3:
      case numberTag$3:
        // Coerce booleans to `1` or `0` and dates to milliseconds.
        // Invalid dates are coerced to `NaN`.
        return eq_1(+object, +other);

      case errorTag$3:
        return object.name == other.name && object.message == other.message;

      case regexpTag$3:
      case stringTag$4:
        // Coerce regexes to strings and treat strings, primitives and objects,
        // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
        // for more details.
        return object == other + '';

      case mapTag$6:
        var convert = _mapToArray;

      case setTag$6:
        var isPartial = bitmask & COMPARE_PARTIAL_FLAG$4;
        convert || (convert = _setToArray);

        if (object.size != other.size && !isPartial) {
          return false;
        } // Assume cyclic values are equal.


        var stacked = stack.get(object);

        if (stacked) {
          return stacked == other;
        }

        bitmask |= COMPARE_UNORDERED_FLAG$2; // Recursively compare objects (susceptible to call stack limits).

        stack.set(object, other);
        var result = _equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
        stack['delete'](object);
        return result;

      case symbolTag$2:
        if (symbolValueOf$1) {
          return symbolValueOf$1.call(object) == symbolValueOf$1.call(other);
        }

    }

    return false;
  }

  var _equalByTag = equalByTag;

  /**
   * Appends the elements of `values` to `array`.
   *
   * @private
   * @param {Array} array The array to modify.
   * @param {Array} values The values to append.
   * @returns {Array} Returns `array`.
   */
  function arrayPush(array, values) {
    var index = -1,
        length = values.length,
        offset = array.length;

    while (++index < length) {
      array[offset + index] = values[index];
    }

    return array;
  }

  var _arrayPush = arrayPush;

  /**
   * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
   * `keysFunc` and `symbolsFunc` to get the enumerable property names and
   * symbols of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Function} keysFunc The function to get the keys of `object`.
   * @param {Function} symbolsFunc The function to get the symbols of `object`.
   * @returns {Array} Returns the array of property names and symbols.
   */

  function baseGetAllKeys(object, keysFunc, symbolsFunc) {
    var result = keysFunc(object);
    return isArray_1(object) ? result : _arrayPush(result, symbolsFunc(object));
  }

  var _baseGetAllKeys = baseGetAllKeys;

  /**
   * A specialized version of `_.filter` for arrays without support for
   * iteratee shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} predicate The function invoked per iteration.
   * @returns {Array} Returns the new filtered array.
   */
  function arrayFilter(array, predicate) {
    var index = -1,
        length = array == null ? 0 : array.length,
        resIndex = 0,
        result = [];

    while (++index < length) {
      var value = array[index];

      if (predicate(value, index, array)) {
        result[resIndex++] = value;
      }
    }

    return result;
  }

  var _arrayFilter = arrayFilter;

  /**
   * This method returns a new empty array.
   *
   * @static
   * @memberOf _
   * @since 4.13.0
   * @category Util
   * @returns {Array} Returns the new empty array.
   * @example
   *
   * var arrays = _.times(2, _.stubArray);
   *
   * console.log(arrays);
   * // => [[], []]
   *
   * console.log(arrays[0] === arrays[1]);
   * // => false
   */
  function stubArray() {
    return [];
  }

  var stubArray_1 = stubArray;

  /** Used for built-in method references. */

  var objectProto$a = Object.prototype;
  /** Built-in value references. */

  var propertyIsEnumerable$1 = objectProto$a.propertyIsEnumerable;
  /* Built-in method references for those with the same name as other `lodash` methods. */

  var nativeGetSymbols$1 = Object.getOwnPropertySymbols;
  /**
   * Creates an array of the own enumerable symbols of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of symbols.
   */

  var getSymbols = !nativeGetSymbols$1 ? stubArray_1 : function (object) {
    if (object == null) {
      return [];
    }

    object = Object(object);
    return _arrayFilter(nativeGetSymbols$1(object), function (symbol) {
      return propertyIsEnumerable$1.call(object, symbol);
    });
  };
  var _getSymbols = getSymbols;

  /**
   * The base implementation of `_.times` without support for iteratee shorthands
   * or max array length checks.
   *
   * @private
   * @param {number} n The number of times to invoke `iteratee`.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the array of results.
   */
  function baseTimes(n, iteratee) {
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = iteratee(index);
    }

    return result;
  }

  var _baseTimes = baseTimes;

  /** `Object#toString` result references. */

  var argsTag$3 = '[object Arguments]';
  /**
   * The base implementation of `_.isArguments`.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an `arguments` object,
   */

  function baseIsArguments(value) {
    return isObjectLike_1(value) && _baseGetTag(value) == argsTag$3;
  }

  var _baseIsArguments = baseIsArguments;

  /** Used for built-in method references. */

  var objectProto$9 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$8 = objectProto$9.hasOwnProperty;
  /** Built-in value references. */

  var propertyIsEnumerable = objectProto$9.propertyIsEnumerable;
  /**
   * Checks if `value` is likely an `arguments` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an `arguments` object,
   *  else `false`.
   * @example
   *
   * _.isArguments(function() { return arguments; }());
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */

  var isArguments = _baseIsArguments(function () {
    return arguments;
  }()) ? _baseIsArguments : function (value) {
    return isObjectLike_1(value) && hasOwnProperty$8.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
  };
  var isArguments_1 = isArguments;

  /**
   * This method returns `false`.
   *
   * @static
   * @memberOf _
   * @since 4.13.0
   * @category Util
   * @returns {boolean} Returns `false`.
   * @example
   *
   * _.times(2, _.stubFalse);
   * // => [false, false]
   */
  function stubFalse() {
    return false;
  }

  var stubFalse_1 = stubFalse;

  var isBuffer_1 = createCommonjsModule(function (module, exports) {
    /** Detect free variable `exports`. */
    var freeExports = exports && !exports.nodeType && exports;
    /** Detect free variable `module`. */

    var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;
    /** Detect the popular CommonJS extension `module.exports`. */

    var moduleExports = freeModule && freeModule.exports === freeExports;
    /** Built-in value references. */

    var Buffer = moduleExports ? _root.Buffer : undefined;
    /* Built-in method references for those with the same name as other `lodash` methods. */

    var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
    /**
     * Checks if `value` is a buffer.
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
     * @example
     *
     * _.isBuffer(new Buffer(2));
     * // => true
     *
     * _.isBuffer(new Uint8Array(2));
     * // => false
     */

    var isBuffer = nativeIsBuffer || stubFalse_1;
    module.exports = isBuffer;
  });

  /** Used as references for various `Number` constants. */
  var MAX_SAFE_INTEGER$1 = 9007199254740991;
  /** Used to detect unsigned integer values. */

  var reIsUint = /^(?:0|[1-9]\d*)$/;
  /**
   * Checks if `value` is a valid array-like index.
   *
   * @private
   * @param {*} value The value to check.
   * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
   * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
   */

  function isIndex(value, length) {
    var type = _typeof(value);

    length = length == null ? MAX_SAFE_INTEGER$1 : length;
    return !!length && (type == 'number' || type != 'symbol' && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
  }

  var _isIndex = isIndex;

  /** Used as references for various `Number` constants. */
  var MAX_SAFE_INTEGER = 9007199254740991;
  /**
   * Checks if `value` is a valid array-like length.
   *
   * **Note:** This method is loosely based on
   * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
   * @example
   *
   * _.isLength(3);
   * // => true
   *
   * _.isLength(Number.MIN_VALUE);
   * // => false
   *
   * _.isLength(Infinity);
   * // => false
   *
   * _.isLength('3');
   * // => false
   */

  function isLength(value) {
    return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
  }

  var isLength_1 = isLength;

  /** `Object#toString` result references. */

  var argsTag$2 = '[object Arguments]',
      arrayTag$2 = '[object Array]',
      boolTag$3 = '[object Boolean]',
      dateTag$2 = '[object Date]',
      errorTag$2 = '[object Error]',
      funcTag$1 = '[object Function]',
      mapTag$5 = '[object Map]',
      numberTag$2 = '[object Number]',
      objectTag$4 = '[object Object]',
      regexpTag$2 = '[object RegExp]',
      setTag$5 = '[object Set]',
      stringTag$3 = '[object String]',
      weakMapTag$2 = '[object WeakMap]';
  var arrayBufferTag$2 = '[object ArrayBuffer]',
      dataViewTag$3 = '[object DataView]',
      float32Tag$2 = '[object Float32Array]',
      float64Tag$2 = '[object Float64Array]',
      int8Tag$2 = '[object Int8Array]',
      int16Tag$2 = '[object Int16Array]',
      int32Tag$2 = '[object Int32Array]',
      uint8Tag$2 = '[object Uint8Array]',
      uint8ClampedTag$2 = '[object Uint8ClampedArray]',
      uint16Tag$2 = '[object Uint16Array]',
      uint32Tag$2 = '[object Uint32Array]';
  /** Used to identify `toStringTag` values of typed arrays. */

  var typedArrayTags = {};
  typedArrayTags[float32Tag$2] = typedArrayTags[float64Tag$2] = typedArrayTags[int8Tag$2] = typedArrayTags[int16Tag$2] = typedArrayTags[int32Tag$2] = typedArrayTags[uint8Tag$2] = typedArrayTags[uint8ClampedTag$2] = typedArrayTags[uint16Tag$2] = typedArrayTags[uint32Tag$2] = true;
  typedArrayTags[argsTag$2] = typedArrayTags[arrayTag$2] = typedArrayTags[arrayBufferTag$2] = typedArrayTags[boolTag$3] = typedArrayTags[dataViewTag$3] = typedArrayTags[dateTag$2] = typedArrayTags[errorTag$2] = typedArrayTags[funcTag$1] = typedArrayTags[mapTag$5] = typedArrayTags[numberTag$2] = typedArrayTags[objectTag$4] = typedArrayTags[regexpTag$2] = typedArrayTags[setTag$5] = typedArrayTags[stringTag$3] = typedArrayTags[weakMapTag$2] = false;
  /**
   * The base implementation of `_.isTypedArray` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   */

  function baseIsTypedArray(value) {
    return isObjectLike_1(value) && isLength_1(value.length) && !!typedArrayTags[_baseGetTag(value)];
  }

  var _baseIsTypedArray = baseIsTypedArray;

  /**
   * The base implementation of `_.unary` without support for storing metadata.
   *
   * @private
   * @param {Function} func The function to cap arguments for.
   * @returns {Function} Returns the new capped function.
   */
  function baseUnary(func) {
    return function (value) {
      return func(value);
    };
  }

  var _baseUnary = baseUnary;

  var _nodeUtil = createCommonjsModule(function (module, exports) {
    /** Detect free variable `exports`. */
    var freeExports = exports && !exports.nodeType && exports;
    /** Detect free variable `module`. */

    var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;
    /** Detect the popular CommonJS extension `module.exports`. */

    var moduleExports = freeModule && freeModule.exports === freeExports;
    /** Detect free variable `process` from Node.js. */

    var freeProcess = moduleExports && _freeGlobal.process;
    /** Used to access faster Node.js helpers. */

    var nodeUtil = function () {
      try {
        // Use `util.types` for Node.js 10+.
        var types = freeModule && freeModule.require && freeModule.require('util').types;

        if (types) {
          return types;
        } // Legacy `process.binding('util')` for Node.js < 10.


        return freeProcess && freeProcess.binding && freeProcess.binding('util');
      } catch (e) {}
    }();

    module.exports = nodeUtil;
  });

  /* Node.js helper references. */

  var nodeIsTypedArray = _nodeUtil && _nodeUtil.isTypedArray;
  /**
   * Checks if `value` is classified as a typed array.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   * @example
   *
   * _.isTypedArray(new Uint8Array);
   * // => true
   *
   * _.isTypedArray([]);
   * // => false
   */

  var isTypedArray = nodeIsTypedArray ? _baseUnary(nodeIsTypedArray) : _baseIsTypedArray;
  var isTypedArray_1 = isTypedArray;

  /** Used for built-in method references. */

  var objectProto$8 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$7 = objectProto$8.hasOwnProperty;
  /**
   * Creates an array of the enumerable property names of the array-like `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @param {boolean} inherited Specify returning inherited property names.
   * @returns {Array} Returns the array of property names.
   */

  function arrayLikeKeys(value, inherited) {
    var isArr = isArray_1(value),
        isArg = !isArr && isArguments_1(value),
        isBuff = !isArr && !isArg && isBuffer_1(value),
        isType = !isArr && !isArg && !isBuff && isTypedArray_1(value),
        skipIndexes = isArr || isArg || isBuff || isType,
        result = skipIndexes ? _baseTimes(value.length, String) : [],
        length = result.length;

    for (var key in value) {
      if ((inherited || hasOwnProperty$7.call(value, key)) && !(skipIndexes && ( // Safari 9 has enumerable `arguments.length` in strict mode.
      key == 'length' || // Node.js 0.10 has enumerable non-index properties on buffers.
      isBuff && (key == 'offset' || key == 'parent') || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset') || // Skip index properties.
      _isIndex(key, length)))) {
        result.push(key);
      }
    }

    return result;
  }

  var _arrayLikeKeys = arrayLikeKeys;

  /** Used for built-in method references. */
  var objectProto$7 = Object.prototype;
  /**
   * Checks if `value` is likely a prototype object.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
   */

  function isPrototype(value) {
    var Ctor = value && value.constructor,
        proto = typeof Ctor == 'function' && Ctor.prototype || objectProto$7;
    return value === proto;
  }

  var _isPrototype = isPrototype;

  /**
   * Creates a unary function that invokes `func` with its argument transformed.
   *
   * @private
   * @param {Function} func The function to wrap.
   * @param {Function} transform The argument transform.
   * @returns {Function} Returns the new function.
   */
  function overArg(func, transform) {
    return function (arg) {
      return func(transform(arg));
    };
  }

  var _overArg = overArg;

  /* Built-in method references for those with the same name as other `lodash` methods. */

  var nativeKeys = _overArg(Object.keys, Object);
  var _nativeKeys = nativeKeys;

  /** Used for built-in method references. */

  var objectProto$6 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$6 = objectProto$6.hasOwnProperty;
  /**
   * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */

  function baseKeys(object) {
    if (!_isPrototype(object)) {
      return _nativeKeys(object);
    }

    var result = [];

    for (var key in Object(object)) {
      if (hasOwnProperty$6.call(object, key) && key != 'constructor') {
        result.push(key);
      }
    }

    return result;
  }

  var _baseKeys = baseKeys;

  /**
   * Checks if `value` is array-like. A value is considered array-like if it's
   * not a function and has a `value.length` that's an integer greater than or
   * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
   * @example
   *
   * _.isArrayLike([1, 2, 3]);
   * // => true
   *
   * _.isArrayLike(document.body.children);
   * // => true
   *
   * _.isArrayLike('abc');
   * // => true
   *
   * _.isArrayLike(_.noop);
   * // => false
   */

  function isArrayLike(value) {
    return value != null && isLength_1(value.length) && !isFunction_1(value);
  }

  var isArrayLike_1 = isArrayLike;

  /**
   * Creates an array of the own enumerable property names of `object`.
   *
   * **Note:** Non-object values are coerced to objects. See the
   * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
   * for more details.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Object
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.keys(new Foo);
   * // => ['a', 'b'] (iteration order is not guaranteed)
   *
   * _.keys('hi');
   * // => ['0', '1']
   */

  function keys(object) {
    return isArrayLike_1(object) ? _arrayLikeKeys(object) : _baseKeys(object);
  }

  var keys_1 = keys;

  /**
   * Creates an array of own enumerable property names and symbols of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names and symbols.
   */

  function getAllKeys(object) {
    return _baseGetAllKeys(object, keys_1, _getSymbols);
  }

  var _getAllKeys = getAllKeys;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG$3 = 1;
  /** Used for built-in method references. */

  var objectProto$5 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$5 = objectProto$5.hasOwnProperty;
  /**
   * A specialized version of `baseIsEqualDeep` for objects with support for
   * partial deep comparisons.
   *
   * @private
   * @param {Object} object The object to compare.
   * @param {Object} other The other object to compare.
   * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
   * @param {Function} customizer The function to customize comparisons.
   * @param {Function} equalFunc The function to determine equivalents of values.
   * @param {Object} stack Tracks traversed `object` and `other` objects.
   * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
   */

  function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG$3,
        objProps = _getAllKeys(object),
        objLength = objProps.length,
        othProps = _getAllKeys(other),
        othLength = othProps.length;

    if (objLength != othLength && !isPartial) {
      return false;
    }

    var index = objLength;

    while (index--) {
      var key = objProps[index];

      if (!(isPartial ? key in other : hasOwnProperty$5.call(other, key))) {
        return false;
      }
    } // Check that cyclic values are equal.


    var objStacked = stack.get(object);
    var othStacked = stack.get(other);

    if (objStacked && othStacked) {
      return objStacked == other && othStacked == object;
    }

    var result = true;
    stack.set(object, other);
    stack.set(other, object);
    var skipCtor = isPartial;

    while (++index < objLength) {
      key = objProps[index];
      var objValue = object[key],
          othValue = other[key];

      if (customizer) {
        var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
      } // Recursively compare objects (susceptible to call stack limits).


      if (!(compared === undefined ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
        result = false;
        break;
      }

      skipCtor || (skipCtor = key == 'constructor');
    }

    if (result && !skipCtor) {
      var objCtor = object.constructor,
          othCtor = other.constructor; // Non `Object` object instances with different constructors are not equal.

      if (objCtor != othCtor && 'constructor' in object && 'constructor' in other && !(typeof objCtor == 'function' && objCtor instanceof objCtor && typeof othCtor == 'function' && othCtor instanceof othCtor)) {
        result = false;
      }
    }

    stack['delete'](object);
    stack['delete'](other);
    return result;
  }

  var _equalObjects = equalObjects;

  /* Built-in method references that are verified to be native. */

  var DataView = _getNative(_root, 'DataView');
  var _DataView = DataView;

  /* Built-in method references that are verified to be native. */

  var Promise$1 = _getNative(_root, 'Promise');
  var _Promise = Promise$1;

  /* Built-in method references that are verified to be native. */

  var Set = _getNative(_root, 'Set');
  var _Set = Set;

  /* Built-in method references that are verified to be native. */

  var WeakMap = _getNative(_root, 'WeakMap');
  var _WeakMap = WeakMap;

  /** `Object#toString` result references. */

  var mapTag$4 = '[object Map]',
      objectTag$3 = '[object Object]',
      promiseTag = '[object Promise]',
      setTag$4 = '[object Set]',
      weakMapTag$1 = '[object WeakMap]';
  var dataViewTag$2 = '[object DataView]';
  /** Used to detect maps, sets, and weakmaps. */

  var dataViewCtorString = _toSource(_DataView),
      mapCtorString = _toSource(_Map),
      promiseCtorString = _toSource(_Promise),
      setCtorString = _toSource(_Set),
      weakMapCtorString = _toSource(_WeakMap);
  /**
   * Gets the `toStringTag` of `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */

  var getTag = _baseGetTag; // Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.

  if (_DataView && getTag(new _DataView(new ArrayBuffer(1))) != dataViewTag$2 || _Map && getTag(new _Map()) != mapTag$4 || _Promise && getTag(_Promise.resolve()) != promiseTag || _Set && getTag(new _Set()) != setTag$4 || _WeakMap && getTag(new _WeakMap()) != weakMapTag$1) {
    getTag = function getTag(value) {
      var result = _baseGetTag(value),
          Ctor = result == objectTag$3 ? value.constructor : undefined,
          ctorString = Ctor ? _toSource(Ctor) : '';

      if (ctorString) {
        switch (ctorString) {
          case dataViewCtorString:
            return dataViewTag$2;

          case mapCtorString:
            return mapTag$4;

          case promiseCtorString:
            return promiseTag;

          case setCtorString:
            return setTag$4;

          case weakMapCtorString:
            return weakMapTag$1;
        }
      }

      return result;
    };
  }

  var _getTag = getTag;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG$2 = 1;
  /** `Object#toString` result references. */

  var argsTag$1 = '[object Arguments]',
      arrayTag$1 = '[object Array]',
      objectTag$2 = '[object Object]';
  /** Used for built-in method references. */

  var objectProto$4 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$4 = objectProto$4.hasOwnProperty;
  /**
   * A specialized version of `baseIsEqual` for arrays and objects which performs
   * deep comparisons and tracks traversed objects enabling objects with circular
   * references to be compared.
   *
   * @private
   * @param {Object} object The object to compare.
   * @param {Object} other The other object to compare.
   * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
   * @param {Function} customizer The function to customize comparisons.
   * @param {Function} equalFunc The function to determine equivalents of values.
   * @param {Object} [stack] Tracks traversed `object` and `other` objects.
   * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
   */

  function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
    var objIsArr = isArray_1(object),
        othIsArr = isArray_1(other),
        objTag = objIsArr ? arrayTag$1 : _getTag(object),
        othTag = othIsArr ? arrayTag$1 : _getTag(other);
    objTag = objTag == argsTag$1 ? objectTag$2 : objTag;
    othTag = othTag == argsTag$1 ? objectTag$2 : othTag;
    var objIsObj = objTag == objectTag$2,
        othIsObj = othTag == objectTag$2,
        isSameTag = objTag == othTag;

    if (isSameTag && isBuffer_1(object)) {
      if (!isBuffer_1(other)) {
        return false;
      }

      objIsArr = true;
      objIsObj = false;
    }

    if (isSameTag && !objIsObj) {
      stack || (stack = new _Stack());
      return objIsArr || isTypedArray_1(object) ? _equalArrays(object, other, bitmask, customizer, equalFunc, stack) : _equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
    }

    if (!(bitmask & COMPARE_PARTIAL_FLAG$2)) {
      var objIsWrapped = objIsObj && hasOwnProperty$4.call(object, '__wrapped__'),
          othIsWrapped = othIsObj && hasOwnProperty$4.call(other, '__wrapped__');

      if (objIsWrapped || othIsWrapped) {
        var objUnwrapped = objIsWrapped ? object.value() : object,
            othUnwrapped = othIsWrapped ? other.value() : other;
        stack || (stack = new _Stack());
        return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
      }
    }

    if (!isSameTag) {
      return false;
    }

    stack || (stack = new _Stack());
    return _equalObjects(object, other, bitmask, customizer, equalFunc, stack);
  }

  var _baseIsEqualDeep = baseIsEqualDeep;

  /**
   * The base implementation of `_.isEqual` which supports partial comparisons
   * and tracks traversed objects.
   *
   * @private
   * @param {*} value The value to compare.
   * @param {*} other The other value to compare.
   * @param {boolean} bitmask The bitmask flags.
   *  1 - Unordered comparison
   *  2 - Partial comparison
   * @param {Function} [customizer] The function to customize comparisons.
   * @param {Object} [stack] Tracks traversed `value` and `other` objects.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   */

  function baseIsEqual(value, other, bitmask, customizer, stack) {
    if (value === other) {
      return true;
    }

    if (value == null || other == null || !isObjectLike_1(value) && !isObjectLike_1(other)) {
      return value !== value && other !== other;
    }

    return _baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
  }

  var _baseIsEqual = baseIsEqual;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG$1 = 1,
      COMPARE_UNORDERED_FLAG$1 = 2;
  /**
   * The base implementation of `_.isMatch` without support for iteratee shorthands.
   *
   * @private
   * @param {Object} object The object to inspect.
   * @param {Object} source The object of property values to match.
   * @param {Array} matchData The property names, values, and compare flags to match.
   * @param {Function} [customizer] The function to customize comparisons.
   * @returns {boolean} Returns `true` if `object` is a match, else `false`.
   */

  function baseIsMatch(object, source, matchData, customizer) {
    var index = matchData.length,
        length = index,
        noCustomizer = !customizer;

    if (object == null) {
      return !length;
    }

    object = Object(object);

    while (index--) {
      var data = matchData[index];

      if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
        return false;
      }
    }

    while (++index < length) {
      data = matchData[index];
      var key = data[0],
          objValue = object[key],
          srcValue = data[1];

      if (noCustomizer && data[2]) {
        if (objValue === undefined && !(key in object)) {
          return false;
        }
      } else {
        var stack = new _Stack();

        if (customizer) {
          var result = customizer(objValue, srcValue, key, object, source, stack);
        }

        if (!(result === undefined ? _baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG$1 | COMPARE_UNORDERED_FLAG$1, customizer, stack) : result)) {
          return false;
        }
      }
    }

    return true;
  }

  var _baseIsMatch = baseIsMatch;

  /**
   * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` if suitable for strict
   *  equality comparisons, else `false`.
   */

  function isStrictComparable(value) {
    return value === value && !isObject_1(value);
  }

  var _isStrictComparable = isStrictComparable;

  /**
   * Gets the property names, values, and compare flags of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the match data of `object`.
   */

  function getMatchData(object) {
    var result = keys_1(object),
        length = result.length;

    while (length--) {
      var key = result[length],
          value = object[key];
      result[length] = [key, value, _isStrictComparable(value)];
    }

    return result;
  }

  var _getMatchData = getMatchData;

  /**
   * A specialized version of `matchesProperty` for source values suitable
   * for strict equality comparisons, i.e. `===`.
   *
   * @private
   * @param {string} key The key of the property to get.
   * @param {*} srcValue The value to match.
   * @returns {Function} Returns the new spec function.
   */
  function matchesStrictComparable(key, srcValue) {
    return function (object) {
      if (object == null) {
        return false;
      }

      return object[key] === srcValue && (srcValue !== undefined || key in Object(object));
    };
  }

  var _matchesStrictComparable = matchesStrictComparable;

  /**
   * The base implementation of `_.matches` which doesn't clone `source`.
   *
   * @private
   * @param {Object} source The object of property values to match.
   * @returns {Function} Returns the new spec function.
   */

  function baseMatches(source) {
    var matchData = _getMatchData(source);

    if (matchData.length == 1 && matchData[0][2]) {
      return _matchesStrictComparable(matchData[0][0], matchData[0][1]);
    }

    return function (object) {
      return object === source || _baseIsMatch(object, source, matchData);
    };
  }

  var _baseMatches = baseMatches;

  /**
   * The base implementation of `_.hasIn` without support for deep paths.
   *
   * @private
   * @param {Object} [object] The object to query.
   * @param {Array|string} key The key to check.
   * @returns {boolean} Returns `true` if `key` exists, else `false`.
   */
  function baseHasIn(object, key) {
    return object != null && key in Object(object);
  }

  var _baseHasIn = baseHasIn;

  /**
   * Checks if `path` exists on `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Array|string} path The path to check.
   * @param {Function} hasFunc The function to check properties.
   * @returns {boolean} Returns `true` if `path` exists, else `false`.
   */

  function hasPath(object, path, hasFunc) {
    path = _castPath(path, object);
    var index = -1,
        length = path.length,
        result = false;

    while (++index < length) {
      var key = _toKey(path[index]);

      if (!(result = object != null && hasFunc(object, key))) {
        break;
      }

      object = object[key];
    }

    if (result || ++index != length) {
      return result;
    }

    length = object == null ? 0 : object.length;
    return !!length && isLength_1(length) && _isIndex(key, length) && (isArray_1(object) || isArguments_1(object));
  }

  var _hasPath = hasPath;

  /**
   * Checks if `path` is a direct or inherited property of `object`.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Object
   * @param {Object} object The object to query.
   * @param {Array|string} path The path to check.
   * @returns {boolean} Returns `true` if `path` exists, else `false`.
   * @example
   *
   * var object = _.create({ 'a': _.create({ 'b': 2 }) });
   *
   * _.hasIn(object, 'a');
   * // => true
   *
   * _.hasIn(object, 'a.b');
   * // => true
   *
   * _.hasIn(object, ['a', 'b']);
   * // => true
   *
   * _.hasIn(object, 'b');
   * // => false
   */

  function hasIn(object, path) {
    return object != null && _hasPath(object, path, _baseHasIn);
  }

  var hasIn_1 = hasIn;

  /** Used to compose bitmasks for value comparisons. */

  var COMPARE_PARTIAL_FLAG = 1,
      COMPARE_UNORDERED_FLAG = 2;
  /**
   * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
   *
   * @private
   * @param {string} path The path of the property to get.
   * @param {*} srcValue The value to match.
   * @returns {Function} Returns the new spec function.
   */

  function baseMatchesProperty(path, srcValue) {
    if (_isKey(path) && _isStrictComparable(srcValue)) {
      return _matchesStrictComparable(_toKey(path), srcValue);
    }

    return function (object) {
      var objValue = get_1(object, path);
      return objValue === undefined && objValue === srcValue ? hasIn_1(object, path) : _baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
    };
  }

  var _baseMatchesProperty = baseMatchesProperty;

  /**
   * This method returns the first argument it receives.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Util
   * @param {*} value Any value.
   * @returns {*} Returns `value`.
   * @example
   *
   * var object = { 'a': 1 };
   *
   * console.log(_.identity(object) === object);
   * // => true
   */
  function identity(value) {
    return value;
  }

  var identity_1 = identity;

  /**
   * The base implementation of `_.property` without support for deep paths.
   *
   * @private
   * @param {string} key The key of the property to get.
   * @returns {Function} Returns the new accessor function.
   */
  function baseProperty(key) {
    return function (object) {
      return object == null ? undefined : object[key];
    };
  }

  var _baseProperty = baseProperty;

  /**
   * A specialized version of `baseProperty` which supports deep paths.
   *
   * @private
   * @param {Array|string} path The path of the property to get.
   * @returns {Function} Returns the new accessor function.
   */

  function basePropertyDeep(path) {
    return function (object) {
      return _baseGet(object, path);
    };
  }

  var _basePropertyDeep = basePropertyDeep;

  /**
   * Creates a function that returns the value at `path` of a given object.
   *
   * @static
   * @memberOf _
   * @since 2.4.0
   * @category Util
   * @param {Array|string} path The path of the property to get.
   * @returns {Function} Returns the new accessor function.
   * @example
   *
   * var objects = [
   *   { 'a': { 'b': 2 } },
   *   { 'a': { 'b': 1 } }
   * ];
   *
   * _.map(objects, _.property('a.b'));
   * // => [2, 1]
   *
   * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
   * // => [1, 2]
   */

  function property(path) {
    return _isKey(path) ? _baseProperty(_toKey(path)) : _basePropertyDeep(path);
  }

  var property_1 = property;

  /**
   * The base implementation of `_.iteratee`.
   *
   * @private
   * @param {*} [value=_.identity] The value to convert to an iteratee.
   * @returns {Function} Returns the iteratee.
   */

  function baseIteratee(value) {
    // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
    // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
    if (typeof value == 'function') {
      return value;
    }

    if (value == null) {
      return identity_1;
    }

    if (_typeof(value) == 'object') {
      return isArray_1(value) ? _baseMatchesProperty(value[0], value[1]) : _baseMatches(value);
    }

    return property_1(value);
  }

  var _baseIteratee = baseIteratee;

  /**
   * Creates a base function for methods like `_.forIn` and `_.forOwn`.
   *
   * @private
   * @param {boolean} [fromRight] Specify iterating from right to left.
   * @returns {Function} Returns the new base function.
   */
  function createBaseFor(fromRight) {
    return function (object, iteratee, keysFunc) {
      var index = -1,
          iterable = Object(object),
          props = keysFunc(object),
          length = props.length;

      while (length--) {
        var key = props[fromRight ? length : ++index];

        if (iteratee(iterable[key], key, iterable) === false) {
          break;
        }
      }

      return object;
    };
  }

  var _createBaseFor = createBaseFor;

  /**
   * The base implementation of `baseForOwn` which iterates over `object`
   * properties returned by `keysFunc` and invokes `iteratee` for each property.
   * Iteratee functions may exit iteration early by explicitly returning `false`.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @param {Function} keysFunc The function to get the keys of `object`.
   * @returns {Object} Returns `object`.
   */

  var baseFor = _createBaseFor();
  var _baseFor = baseFor;

  /**
   * The base implementation of `_.forOwn` without support for iteratee shorthands.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Object} Returns `object`.
   */

  function baseForOwn(object, iteratee) {
    return object && _baseFor(object, iteratee, keys_1);
  }

  var _baseForOwn = baseForOwn;

  /**
   * Creates a `baseEach` or `baseEachRight` function.
   *
   * @private
   * @param {Function} eachFunc The function to iterate over a collection.
   * @param {boolean} [fromRight] Specify iterating from right to left.
   * @returns {Function} Returns the new base function.
   */

  function createBaseEach(eachFunc, fromRight) {
    return function (collection, iteratee) {
      if (collection == null) {
        return collection;
      }

      if (!isArrayLike_1(collection)) {
        return eachFunc(collection, iteratee);
      }

      var length = collection.length,
          index = fromRight ? length : -1,
          iterable = Object(collection);

      while (fromRight ? index-- : ++index < length) {
        if (iteratee(iterable[index], index, iterable) === false) {
          break;
        }
      }

      return collection;
    };
  }

  var _createBaseEach = createBaseEach;

  /**
   * The base implementation of `_.forEach` without support for iteratee shorthands.
   *
   * @private
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array|Object} Returns `collection`.
   */

  var baseEach = _createBaseEach(_baseForOwn);
  var _baseEach = baseEach;

  /**
   * The base implementation of `_.map` without support for iteratee shorthands.
   *
   * @private
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the new mapped array.
   */

  function baseMap(collection, iteratee) {
    var index = -1,
        result = isArrayLike_1(collection) ? Array(collection.length) : [];
    _baseEach(collection, function (value, key, collection) {
      result[++index] = iteratee(value, key, collection);
    });
    return result;
  }

  var _baseMap = baseMap;

  /**
   * Creates an array of values by running each element in `collection` thru
   * `iteratee`. The iteratee is invoked with three arguments:
   * (value, index|key, collection).
   *
   * Many lodash methods are guarded to work as iteratees for methods like
   * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
   *
   * The guarded methods are:
   * `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
   * `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
   * `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
   * `template`, `trim`, `trimEnd`, `trimStart`, and `words`
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Collection
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} [iteratee=_.identity] The function invoked per iteration.
   * @returns {Array} Returns the new mapped array.
   * @example
   *
   * function square(n) {
   *   return n * n;
   * }
   *
   * _.map([4, 8], square);
   * // => [16, 64]
   *
   * _.map({ 'a': 4, 'b': 8 }, square);
   * // => [16, 64] (iteration order is not guaranteed)
   *
   * var users = [
   *   { 'user': 'barney' },
   *   { 'user': 'fred' }
   * ];
   *
   * // The `_.property` iteratee shorthand.
   * _.map(users, 'user');
   * // => ['barney', 'fred']
   */

  function map(collection, iteratee) {
    var func = isArray_1(collection) ? _arrayMap : _baseMap;
    return func(collection, _baseIteratee(iteratee));
  }

  var map_1 = map;

  /**
   * A specialized version of `_.forEach` for arrays without support for
   * iteratee shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns `array`.
   */
  function arrayEach(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (iteratee(array[index], index, array) === false) {
        break;
      }
    }

    return array;
  }

  var _arrayEach = arrayEach;

  /**
   * Casts `value` to `identity` if it's not a function.
   *
   * @private
   * @param {*} value The value to inspect.
   * @returns {Function} Returns cast function.
   */

  function castFunction(value) {
    return typeof value == 'function' ? value : identity_1;
  }

  var _castFunction = castFunction;

  /**
   * Iterates over elements of `collection` and invokes `iteratee` for each element.
   * The iteratee is invoked with three arguments: (value, index|key, collection).
   * Iteratee functions may exit iteration early by explicitly returning `false`.
   *
   * **Note:** As with other "Collections" methods, objects with a "length"
   * property are iterated like arrays. To avoid this behavior use `_.forIn`
   * or `_.forOwn` for object iteration.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @alias each
   * @category Collection
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} [iteratee=_.identity] The function invoked per iteration.
   * @returns {Array|Object} Returns `collection`.
   * @see _.forEachRight
   * @example
   *
   * _.forEach([1, 2], function(value) {
   *   console.log(value);
   * });
   * // => Logs `1` then `2`.
   *
   * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
   *   console.log(key);
   * });
   * // => Logs 'a' then 'b' (iteration order is not guaranteed).
   */

  function forEach(collection, iteratee) {
    var func = isArray_1(collection) ? _arrayEach : _baseEach;
    return func(collection, _castFunction(iteratee));
  }

  var forEach_1 = forEach;

  var each = forEach_1;

  var defineProperty = function () {
    try {
      var func = _getNative(Object, 'defineProperty');
      func({}, '', {});
      return func;
    } catch (e) {}
  }();

  var _defineProperty = defineProperty;

  /**
   * The base implementation of `assignValue` and `assignMergeValue` without
   * value checks.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */

  function baseAssignValue(object, key, value) {
    if (key == '__proto__' && _defineProperty) {
      _defineProperty(object, key, {
        'configurable': true,
        'enumerable': true,
        'value': value,
        'writable': true
      });
    } else {
      object[key] = value;
    }
  }

  var _baseAssignValue = baseAssignValue;

  /** Used for built-in method references. */

  var objectProto$3 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$3 = objectProto$3.hasOwnProperty;
  /**
   * Assigns `value` to `key` of `object` if the existing value is not equivalent
   * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
   * for equality comparisons.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */

  function assignValue(object, key, value) {
    var objValue = object[key];

    if (!(hasOwnProperty$3.call(object, key) && eq_1(objValue, value)) || value === undefined && !(key in object)) {
      _baseAssignValue(object, key, value);
    }
  }

  var _assignValue = assignValue;

  /**
   * Copies properties of `source` to `object`.
   *
   * @private
   * @param {Object} source The object to copy properties from.
   * @param {Array} props The property identifiers to copy.
   * @param {Object} [object={}] The object to copy properties to.
   * @param {Function} [customizer] The function to customize copied values.
   * @returns {Object} Returns `object`.
   */

  function copyObject(source, props, object, customizer) {
    var isNew = !object;
    object || (object = {});
    var index = -1,
        length = props.length;

    while (++index < length) {
      var key = props[index];
      var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;

      if (newValue === undefined) {
        newValue = source[key];
      }

      if (isNew) {
        _baseAssignValue(object, key, newValue);
      } else {
        _assignValue(object, key, newValue);
      }
    }

    return object;
  }

  var _copyObject = copyObject;

  /**
   * The base implementation of `_.assign` without support for multiple sources
   * or `customizer` functions.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @returns {Object} Returns `object`.
   */

  function baseAssign(object, source) {
    return object && _copyObject(source, keys_1(source), object);
  }

  var _baseAssign = baseAssign;

  /**
   * This function is like
   * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
   * except that it includes inherited enumerable properties.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */
  function nativeKeysIn(object) {
    var result = [];

    if (object != null) {
      for (var key in Object(object)) {
        result.push(key);
      }
    }

    return result;
  }

  var _nativeKeysIn = nativeKeysIn;

  /** Used for built-in method references. */

  var objectProto$2 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$2 = objectProto$2.hasOwnProperty;
  /**
   * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */

  function baseKeysIn(object) {
    if (!isObject_1(object)) {
      return _nativeKeysIn(object);
    }

    var isProto = _isPrototype(object),
        result = [];

    for (var key in object) {
      if (!(key == 'constructor' && (isProto || !hasOwnProperty$2.call(object, key)))) {
        result.push(key);
      }
    }

    return result;
  }

  var _baseKeysIn = baseKeysIn;

  /**
   * Creates an array of the own and inherited enumerable property names of `object`.
   *
   * **Note:** Non-object values are coerced to objects.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Object
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.keysIn(new Foo);
   * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
   */

  function keysIn(object) {
    return isArrayLike_1(object) ? _arrayLikeKeys(object, true) : _baseKeysIn(object);
  }

  var keysIn_1 = keysIn;

  /**
   * The base implementation of `_.assignIn` without support for multiple sources
   * or `customizer` functions.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @returns {Object} Returns `object`.
   */

  function baseAssignIn(object, source) {
    return object && _copyObject(source, keysIn_1(source), object);
  }

  var _baseAssignIn = baseAssignIn;

  var _cloneBuffer = createCommonjsModule(function (module, exports) {
    /** Detect free variable `exports`. */
    var freeExports = exports && !exports.nodeType && exports;
    /** Detect free variable `module`. */

    var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;
    /** Detect the popular CommonJS extension `module.exports`. */

    var moduleExports = freeModule && freeModule.exports === freeExports;
    /** Built-in value references. */

    var Buffer = moduleExports ? _root.Buffer : undefined,
        allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined;
    /**
     * Creates a clone of  `buffer`.
     *
     * @private
     * @param {Buffer} buffer The buffer to clone.
     * @param {boolean} [isDeep] Specify a deep clone.
     * @returns {Buffer} Returns the cloned buffer.
     */

    function cloneBuffer(buffer, isDeep) {
      if (isDeep) {
        return buffer.slice();
      }

      var length = buffer.length,
          result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
      buffer.copy(result);
      return result;
    }

    module.exports = cloneBuffer;
  });

  /**
   * Copies the values of `source` to `array`.
   *
   * @private
   * @param {Array} source The array to copy values from.
   * @param {Array} [array=[]] The array to copy values to.
   * @returns {Array} Returns `array`.
   */
  function copyArray(source, array) {
    var index = -1,
        length = source.length;
    array || (array = Array(length));

    while (++index < length) {
      array[index] = source[index];
    }

    return array;
  }

  var _copyArray = copyArray;

  /**
   * Copies own symbols of `source` to `object`.
   *
   * @private
   * @param {Object} source The object to copy symbols from.
   * @param {Object} [object={}] The object to copy symbols to.
   * @returns {Object} Returns `object`.
   */

  function copySymbols(source, object) {
    return _copyObject(source, _getSymbols(source), object);
  }

  var _copySymbols = copySymbols;

  /** Built-in value references. */

  var getPrototype = _overArg(Object.getPrototypeOf, Object);
  var _getPrototype = getPrototype;

  /* Built-in method references for those with the same name as other `lodash` methods. */

  var nativeGetSymbols = Object.getOwnPropertySymbols;
  /**
   * Creates an array of the own and inherited enumerable symbols of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of symbols.
   */

  var getSymbolsIn = !nativeGetSymbols ? stubArray_1 : function (object) {
    var result = [];

    while (object) {
      _arrayPush(result, _getSymbols(object));
      object = _getPrototype(object);
    }

    return result;
  };
  var _getSymbolsIn = getSymbolsIn;

  /**
   * Copies own and inherited symbols of `source` to `object`.
   *
   * @private
   * @param {Object} source The object to copy symbols from.
   * @param {Object} [object={}] The object to copy symbols to.
   * @returns {Object} Returns `object`.
   */

  function copySymbolsIn(source, object) {
    return _copyObject(source, _getSymbolsIn(source), object);
  }

  var _copySymbolsIn = copySymbolsIn;

  /**
   * Creates an array of own and inherited enumerable property names and
   * symbols of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names and symbols.
   */

  function getAllKeysIn(object) {
    return _baseGetAllKeys(object, keysIn_1, _getSymbolsIn);
  }

  var _getAllKeysIn = getAllKeysIn;

  /** Used for built-in method references. */
  var objectProto$1 = Object.prototype;
  /** Used to check objects for own properties. */

  var hasOwnProperty$1 = objectProto$1.hasOwnProperty;
  /**
   * Initializes an array clone.
   *
   * @private
   * @param {Array} array The array to clone.
   * @returns {Array} Returns the initialized clone.
   */

  function initCloneArray(array) {
    var length = array.length,
        result = new array.constructor(length); // Add properties assigned by `RegExp#exec`.

    if (length && typeof array[0] == 'string' && hasOwnProperty$1.call(array, 'index')) {
      result.index = array.index;
      result.input = array.input;
    }

    return result;
  }

  var _initCloneArray = initCloneArray;

  /**
   * Creates a clone of `arrayBuffer`.
   *
   * @private
   * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
   * @returns {ArrayBuffer} Returns the cloned array buffer.
   */

  function cloneArrayBuffer(arrayBuffer) {
    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
    new _Uint8Array(result).set(new _Uint8Array(arrayBuffer));
    return result;
  }

  var _cloneArrayBuffer = cloneArrayBuffer;

  /**
   * Creates a clone of `dataView`.
   *
   * @private
   * @param {Object} dataView The data view to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the cloned data view.
   */

  function cloneDataView(dataView, isDeep) {
    var buffer = isDeep ? _cloneArrayBuffer(dataView.buffer) : dataView.buffer;
    return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
  }

  var _cloneDataView = cloneDataView;

  /** Used to match `RegExp` flags from their coerced string values. */
  var reFlags = /\w*$/;
  /**
   * Creates a clone of `regexp`.
   *
   * @private
   * @param {Object} regexp The regexp to clone.
   * @returns {Object} Returns the cloned regexp.
   */

  function cloneRegExp(regexp) {
    var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
    result.lastIndex = regexp.lastIndex;
    return result;
  }

  var _cloneRegExp = cloneRegExp;

  /** Used to convert symbols to primitives and strings. */

  var symbolProto = _Symbol ? _Symbol.prototype : undefined,
      symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
  /**
   * Creates a clone of the `symbol` object.
   *
   * @private
   * @param {Object} symbol The symbol object to clone.
   * @returns {Object} Returns the cloned symbol object.
   */

  function cloneSymbol(symbol) {
    return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
  }

  var _cloneSymbol = cloneSymbol;

  /**
   * Creates a clone of `typedArray`.
   *
   * @private
   * @param {Object} typedArray The typed array to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the cloned typed array.
   */

  function cloneTypedArray(typedArray, isDeep) {
    var buffer = isDeep ? _cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
  }

  var _cloneTypedArray = cloneTypedArray;

  /** `Object#toString` result references. */

  var boolTag$2 = '[object Boolean]',
      dateTag$1 = '[object Date]',
      mapTag$3 = '[object Map]',
      numberTag$1 = '[object Number]',
      regexpTag$1 = '[object RegExp]',
      setTag$3 = '[object Set]',
      stringTag$2 = '[object String]',
      symbolTag$1 = '[object Symbol]';
  var arrayBufferTag$1 = '[object ArrayBuffer]',
      dataViewTag$1 = '[object DataView]',
      float32Tag$1 = '[object Float32Array]',
      float64Tag$1 = '[object Float64Array]',
      int8Tag$1 = '[object Int8Array]',
      int16Tag$1 = '[object Int16Array]',
      int32Tag$1 = '[object Int32Array]',
      uint8Tag$1 = '[object Uint8Array]',
      uint8ClampedTag$1 = '[object Uint8ClampedArray]',
      uint16Tag$1 = '[object Uint16Array]',
      uint32Tag$1 = '[object Uint32Array]';
  /**
   * Initializes an object clone based on its `toStringTag`.
   *
   * **Note:** This function only supports cloning values with tags of
   * `Boolean`, `Date`, `Error`, `Map`, `Number`, `RegExp`, `Set`, or `String`.
   *
   * @private
   * @param {Object} object The object to clone.
   * @param {string} tag The `toStringTag` of the object to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the initialized clone.
   */

  function initCloneByTag(object, tag, isDeep) {
    var Ctor = object.constructor;

    switch (tag) {
      case arrayBufferTag$1:
        return _cloneArrayBuffer(object);

      case boolTag$2:
      case dateTag$1:
        return new Ctor(+object);

      case dataViewTag$1:
        return _cloneDataView(object, isDeep);

      case float32Tag$1:
      case float64Tag$1:
      case int8Tag$1:
      case int16Tag$1:
      case int32Tag$1:
      case uint8Tag$1:
      case uint8ClampedTag$1:
      case uint16Tag$1:
      case uint32Tag$1:
        return _cloneTypedArray(object, isDeep);

      case mapTag$3:
        return new Ctor();

      case numberTag$1:
      case stringTag$2:
        return new Ctor(object);

      case regexpTag$1:
        return _cloneRegExp(object);

      case setTag$3:
        return new Ctor();

      case symbolTag$1:
        return _cloneSymbol(object);
    }
  }

  var _initCloneByTag = initCloneByTag;

  /** Built-in value references. */

  var objectCreate = Object.create;
  /**
   * The base implementation of `_.create` without support for assigning
   * properties to the created object.
   *
   * @private
   * @param {Object} proto The object to inherit from.
   * @returns {Object} Returns the new object.
   */

  var baseCreate = function () {
    function object() {}

    return function (proto) {
      if (!isObject_1(proto)) {
        return {};
      }

      if (objectCreate) {
        return objectCreate(proto);
      }

      object.prototype = proto;
      var result = new object();
      object.prototype = undefined;
      return result;
    };
  }();

  var _baseCreate = baseCreate;

  /**
   * Initializes an object clone.
   *
   * @private
   * @param {Object} object The object to clone.
   * @returns {Object} Returns the initialized clone.
   */

  function initCloneObject(object) {
    return typeof object.constructor == 'function' && !_isPrototype(object) ? _baseCreate(_getPrototype(object)) : {};
  }

  var _initCloneObject = initCloneObject;

  /** `Object#toString` result references. */

  var mapTag$2 = '[object Map]';
  /**
   * The base implementation of `_.isMap` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a map, else `false`.
   */

  function baseIsMap(value) {
    return isObjectLike_1(value) && _getTag(value) == mapTag$2;
  }

  var _baseIsMap = baseIsMap;

  /* Node.js helper references. */

  var nodeIsMap = _nodeUtil && _nodeUtil.isMap;
  /**
   * Checks if `value` is classified as a `Map` object.
   *
   * @static
   * @memberOf _
   * @since 4.3.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a map, else `false`.
   * @example
   *
   * _.isMap(new Map);
   * // => true
   *
   * _.isMap(new WeakMap);
   * // => false
   */

  var isMap = nodeIsMap ? _baseUnary(nodeIsMap) : _baseIsMap;
  var isMap_1 = isMap;

  /** `Object#toString` result references. */

  var setTag$2 = '[object Set]';
  /**
   * The base implementation of `_.isSet` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a set, else `false`.
   */

  function baseIsSet(value) {
    return isObjectLike_1(value) && _getTag(value) == setTag$2;
  }

  var _baseIsSet = baseIsSet;

  /* Node.js helper references. */

  var nodeIsSet = _nodeUtil && _nodeUtil.isSet;
  /**
   * Checks if `value` is classified as a `Set` object.
   *
   * @static
   * @memberOf _
   * @since 4.3.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a set, else `false`.
   * @example
   *
   * _.isSet(new Set);
   * // => true
   *
   * _.isSet(new WeakSet);
   * // => false
   */

  var isSet = nodeIsSet ? _baseUnary(nodeIsSet) : _baseIsSet;
  var isSet_1 = isSet;

  /** Used to compose bitmasks for cloning. */

  var CLONE_DEEP_FLAG$1 = 1,
      CLONE_FLAT_FLAG = 2,
      CLONE_SYMBOLS_FLAG$1 = 4;
  /** `Object#toString` result references. */

  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag$1 = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag$1 = '[object Error]',
      funcTag = '[object Function]',
      genTag = '[object GeneratorFunction]',
      mapTag$1 = '[object Map]',
      numberTag = '[object Number]',
      objectTag$1 = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag$1 = '[object Set]',
      stringTag$1 = '[object String]',
      symbolTag = '[object Symbol]',
      weakMapTag = '[object WeakMap]';
  var arrayBufferTag = '[object ArrayBuffer]',
      dataViewTag = '[object DataView]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';
  /** Used to identify `toStringTag` values supported by `_.clone`. */

  var cloneableTags = {};
  cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag$1] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag$1] = cloneableTags[numberTag] = cloneableTags[objectTag$1] = cloneableTags[regexpTag] = cloneableTags[setTag$1] = cloneableTags[stringTag$1] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
  cloneableTags[errorTag$1] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
  /**
   * The base implementation of `_.clone` and `_.cloneDeep` which tracks
   * traversed objects.
   *
   * @private
   * @param {*} value The value to clone.
   * @param {boolean} bitmask The bitmask flags.
   *  1 - Deep clone
   *  2 - Flatten inherited properties
   *  4 - Clone symbols
   * @param {Function} [customizer] The function to customize cloning.
   * @param {string} [key] The key of `value`.
   * @param {Object} [object] The parent object of `value`.
   * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
   * @returns {*} Returns the cloned value.
   */

  function baseClone(value, bitmask, customizer, key, object, stack) {
    var result,
        isDeep = bitmask & CLONE_DEEP_FLAG$1,
        isFlat = bitmask & CLONE_FLAT_FLAG,
        isFull = bitmask & CLONE_SYMBOLS_FLAG$1;

    if (customizer) {
      result = object ? customizer(value, key, object, stack) : customizer(value);
    }

    if (result !== undefined) {
      return result;
    }

    if (!isObject_1(value)) {
      return value;
    }

    var isArr = isArray_1(value);

    if (isArr) {
      result = _initCloneArray(value);

      if (!isDeep) {
        return _copyArray(value, result);
      }
    } else {
      var tag = _getTag(value),
          isFunc = tag == funcTag || tag == genTag;

      if (isBuffer_1(value)) {
        return _cloneBuffer(value, isDeep);
      }

      if (tag == objectTag$1 || tag == argsTag || isFunc && !object) {
        result = isFlat || isFunc ? {} : _initCloneObject(value);

        if (!isDeep) {
          return isFlat ? _copySymbolsIn(value, _baseAssignIn(result, value)) : _copySymbols(value, _baseAssign(result, value));
        }
      } else {
        if (!cloneableTags[tag]) {
          return object ? value : {};
        }

        result = _initCloneByTag(value, tag, isDeep);
      }
    } // Check for circular references and return its corresponding clone.


    stack || (stack = new _Stack());
    var stacked = stack.get(value);

    if (stacked) {
      return stacked;
    }

    stack.set(value, result);

    if (isSet_1(value)) {
      value.forEach(function (subValue) {
        result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
      });
    } else if (isMap_1(value)) {
      value.forEach(function (subValue, key) {
        result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
      });
    }

    var keysFunc = isFull ? isFlat ? _getAllKeysIn : _getAllKeys : isFlat ? keysIn_1 : keys_1;
    var props = isArr ? undefined : keysFunc(value);
    _arrayEach(props || value, function (subValue, key) {
      if (props) {
        key = subValue;
        subValue = value[key];
      } // Recursively populate clone (susceptible to call stack limits).


      _assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
    });
    return result;
  }

  var _baseClone = baseClone;

  /** Used to compose bitmasks for cloning. */

  var CLONE_DEEP_FLAG = 1,
      CLONE_SYMBOLS_FLAG = 4;
  /**
   * This method is like `_.clone` except that it recursively clones `value`.
   *
   * @static
   * @memberOf _
   * @since 1.0.0
   * @category Lang
   * @param {*} value The value to recursively clone.
   * @returns {*} Returns the deep cloned value.
   * @see _.clone
   * @example
   *
   * var objects = [{ 'a': 1 }, { 'b': 2 }];
   *
   * var deep = _.cloneDeep(objects);
   * console.log(deep[0] === objects[0]);
   * // => false
   */

  function cloneDeep(value) {
    return _baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
  }

  var cloneDeep_1 = cloneDeep;

  /**
   * 產生Promise物件，具備鏈式resolve與reject
   * 主要受jQuery Deferred概念啟發
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/genPm.test.js Github}
   * @memberOf wsemi
   * @returns {Object} 回傳Promise物件
   * @example
   *
   * async function topAsync() {
   *
   *     function test1() {
   *         return new Promise((resolve, reject) => {
   *             let ms = []
   *
   *             let fn = function(name) {
   *                 let pm = genPm()
   *                 setTimeout(function() {
   *                     ms.push('resolve: ' + name)
   *                     pm.resolve('resolve: ' + name)
   *                 }, 1)
   *                 return pm
   *             }
   *
   *             fn('abc')
   *                 .then(function(msg) {
   *                     console.log('t1 then', msg)
   *                     ms.push('t1 then: ' + msg)
   *                 })
   *                 .catch(function(msg) {
   *                     console.log('t1 catch', msg)
   *                     ms.push('t1 catch: ' + msg)
   *                 })
   *                 .finally(() => {
   *                     resolve(ms)
   *                 })
   *
   *         })
   *     }
   *     console.log('test1')
   *     let r1 = await test1()
   *     console.log(JSON.stringify(r1))
   *     // test1
   *     // t1 then resolve: abc
   *     // ["resolve: abc","t1 then: resolve: abc"]
   *
   *     function test2() {
   *         return new Promise((resolve, reject) => {
   *             let ms = []
   *
   *             let fn = function(name) {
   *                 let pm = genPm()
   *                 setTimeout(function() {
   *                     ms.push('reject: ' + name)
   *                     pm.reject('reject: ' + name)
   *                 }, 1)
   *                 return pm
   *             }
   *
   *             fn('abc')
   *                 .then(function(msg) {
   *                     console.log('t1 then', msg)
   *                     ms.push('t1 then: ' + msg)
   *                 })
   *                 .catch(function(msg) {
   *                     console.log('t1 catch', msg)
   *                     ms.push('t1 catch: ' + msg)
   *                 })
   *                 .finally(() => {
   *                     resolve(ms)
   *                 })
   *
   *         })
   *     }
   *     console.log('test2')
   *     let r2 = await test2()
   *     console.log(JSON.stringify(r2))
   *     // test2
   *     // t1 catch reject: abc
   *     // ["reject: abc","t1 catch: reject: abc"]
   *
   * }
   * topAsync().catch(() => {})
   *
   */
  function genPm() {
    var resolve;
    var reject;
    var p = new Promise(function () {
      resolve = arguments[0];
      reject = arguments[1];
    });
    p.resolve = resolve;
    p.reject = reject;
    return p;
  }

  /** `Object#toString` result references. */

  var stringTag = '[object String]';
  /**
   * Checks if `value` is classified as a `String` primitive or object.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a string, else `false`.
   * @example
   *
   * _.isString('abc');
   * // => true
   *
   * _.isString(1);
   * // => false
   */

  function isString(value) {
    return typeof value == 'string' || !isArray_1(value) && isObjectLike_1(value) && _baseGetTag(value) == stringTag;
  }

  var isString_1 = isString;

  /**
   * Gets the size of an ASCII `string`.
   *
   * @private
   * @param {string} string The string inspect.
   * @returns {number} Returns the string size.
   */

  var asciiSize = _baseProperty('length');
  var _asciiSize = asciiSize;

  /** Used to compose unicode character classes. */
  var rsAstralRange$1 = "\\ud800-\\udfff",
      rsComboMarksRange$1 = "\\u0300-\\u036f",
      reComboHalfMarksRange$1 = "\\ufe20-\\ufe2f",
      rsComboSymbolsRange$1 = "\\u20d0-\\u20ff",
      rsComboRange$1 = rsComboMarksRange$1 + reComboHalfMarksRange$1 + rsComboSymbolsRange$1,
      rsVarRange$1 = "\\ufe0e\\ufe0f";
  /** Used to compose unicode capture groups. */

  var rsZWJ$1 = "\\u200d";
  /** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */

  var reHasUnicode = RegExp('[' + rsZWJ$1 + rsAstralRange$1 + rsComboRange$1 + rsVarRange$1 + ']');
  /**
   * Checks if `string` contains Unicode symbols.
   *
   * @private
   * @param {string} string The string to inspect.
   * @returns {boolean} Returns `true` if a symbol is found, else `false`.
   */

  function hasUnicode(string) {
    return reHasUnicode.test(string);
  }

  var _hasUnicode = hasUnicode;

  /** Used to compose unicode character classes. */
  var rsAstralRange = "\\ud800-\\udfff",
      rsComboMarksRange = "\\u0300-\\u036f",
      reComboHalfMarksRange = "\\ufe20-\\ufe2f",
      rsComboSymbolsRange = "\\u20d0-\\u20ff",
      rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange,
      rsVarRange = "\\ufe0e\\ufe0f";
  /** Used to compose unicode capture groups. */

  var rsAstral = '[' + rsAstralRange + ']',
      rsCombo = '[' + rsComboRange + ']',
      rsFitz = "\\ud83c[\\udffb-\\udfff]",
      rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
      rsNonAstral = '[^' + rsAstralRange + ']',
      rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}",
      rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]",
      rsZWJ = "\\u200d";
  /** Used to compose unicode regexes. */

  var reOptMod = rsModifier + '?',
      rsOptVar = '[' + rsVarRange + ']?',
      rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
      rsSeq = rsOptVar + reOptMod + rsOptJoin,
      rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';
  /** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */

  var reUnicode = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');
  /**
   * Gets the size of a Unicode `string`.
   *
   * @private
   * @param {string} string The string inspect.
   * @returns {number} Returns the string size.
   */

  function unicodeSize(string) {
    var result = reUnicode.lastIndex = 0;

    while (reUnicode.test(string)) {
      ++result;
    }

    return result;
  }

  var _unicodeSize = unicodeSize;

  /**
   * Gets the number of symbols in `string`.
   *
   * @private
   * @param {string} string The string to inspect.
   * @returns {number} Returns the string size.
   */

  function stringSize(string) {
    return _hasUnicode(string) ? _unicodeSize(string) : _asciiSize(string);
  }

  var _stringSize = stringSize;

  /** `Object#toString` result references. */

  var mapTag = '[object Map]',
      setTag = '[object Set]';
  /**
   * Gets the size of `collection` by returning its length for array-like
   * values or the number of own enumerable string keyed properties for objects.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Collection
   * @param {Array|Object|string} collection The collection to inspect.
   * @returns {number} Returns the collection size.
   * @example
   *
   * _.size([1, 2, 3]);
   * // => 3
   *
   * _.size({ 'a': 1, 'b': 2 });
   * // => 2
   *
   * _.size('pebbles');
   * // => 7
   */

  function size(collection) {
    if (collection == null) {
      return 0;
    }

    if (isArrayLike_1(collection)) {
      return isString_1(collection) ? _stringSize(collection) : collection.length;
    }

    var tag = _getTag(collection);

    if (tag == mapTag || tag == setTag) {
      return collection.size;
    }

    return _baseKeys(collection).length;
  }

  var size_1 = size;

  var eventemitter3 = createCommonjsModule(function (module) {

    var has = Object.prototype.hasOwnProperty,
        prefix = '~';
    /**
     * Constructor to create a storage for our `EE` objects.
     * An `Events` instance is a plain object whose properties are event names.
     *
     * @constructor
     * @private
     */

    function Events() {} //
    // We try to not inherit from `Object.prototype`. In some engines creating an
    // instance in this way is faster than calling `Object.create(null)` directly.
    // If `Object.create(null)` is not supported we prefix the event names with a
    // character to make sure that the built-in object properties are not
    // overridden or used as an attack vector.
    //


    if (Object.create) {
      Events.prototype = Object.create(null); //
      // This hack is needed because the `__proto__` property is still inherited in
      // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
      //

      if (!new Events().__proto__) prefix = false;
    }
    /**
     * Representation of a single event listener.
     *
     * @param {Function} fn The listener function.
     * @param {*} context The context to invoke the listener with.
     * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
     * @constructor
     * @private
     */


    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    /**
     * Add a listener for a given event.
     *
     * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn The listener function.
     * @param {*} context The context to invoke the listener with.
     * @param {Boolean} once Specify if the listener is a one-time listener.
     * @returns {EventEmitter}
     * @private
     */


    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== 'function') {
        throw new TypeError('The listener must be a function');
      }

      var listener = new EE(fn, context || emitter, once),
          evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    /**
     * Clear event by name.
     *
     * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
     * @param {(String|Symbol)} evt The Event name.
     * @private
     */


    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();else delete emitter._events[evt];
    }
    /**
     * Minimal `EventEmitter` interface that is molded against the Node.js
     * `EventEmitter` interface.
     *
     * @constructor
     * @public
     */


    function EventEmitter() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    /**
     * Return an array listing the events for which the emitter has registered
     * listeners.
     *
     * @returns {Array}
     * @public
     */


    EventEmitter.prototype.eventNames = function eventNames() {
      var names = [],
          events,
          name;
      if (this._eventsCount === 0) return names;

      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }

      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }

      return names;
    };
    /**
     * Return the listeners registered for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Array} The registered listeners.
     * @public
     */


    EventEmitter.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event,
          handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];

      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }

      return ee;
    };
    /**
     * Return the number of listeners listening to a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Number} The number of listeners.
     * @public
     */


    EventEmitter.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event,
          listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    /**
     * Calls each of the listeners registered for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @returns {Boolean} `true` if the event had listeners, else `false`.
     * @public
     */


    EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt],
          len = arguments.length,
          args,
          i;

      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;

          case 2:
            return listeners.fn.call(listeners.context, a1), true;

          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;

          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;

          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;

          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }

        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length,
            j;

        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;

            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;

            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;

            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;

            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }

      return true;
    };
    /**
     * Add a listener for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     */


    EventEmitter.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    /**
     * Add a one-time listener for a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn The listener function.
     * @param {*} [context=this] The context to invoke the listener with.
     * @returns {EventEmitter} `this`.
     * @public
     */


    EventEmitter.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    /**
     * Remove the listeners of a given event.
     *
     * @param {(String|Symbol)} event The event name.
     * @param {Function} fn Only remove the listeners that match this function.
     * @param {*} context Only remove the listeners that have this context.
     * @param {Boolean} once Only remove one-time listeners.
     * @returns {EventEmitter} `this`.
     * @public
     */


    EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;

      if (!fn) {
        clearEvent(this, evt);
        return this;
      }

      var listeners = this._events[evt];

      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        } //
        // Reset the array, or remove it completely if we have no more listeners.
        //


        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;else clearEvent(this, evt);
      }

      return this;
    };
    /**
     * Remove all listeners, or those of the specified event.
     *
     * @param {(String|Symbol)} [event] The event name.
     * @returns {EventEmitter} `this`.
     * @public
     */


    EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;

      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }

      return this;
    }; //
    // Alias methods names because people roll like that.
    //


    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.addListener = EventEmitter.prototype.on; //
    // Expose the prefix.
    //

    EventEmitter.prefixed = prefix; //
    // Allow `EventEmitter` to be imported as module namespace.
    //

    EventEmitter.EventEmitter = EventEmitter; //
    // Expose the module.
    //

    {
      module.exports = EventEmitter;
    }
  });

  /**
   * EventEmitter from eventemitter3
   *
   * See: {@link https://github.com/primus/eventemitter3 eventemitter3}
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/evem.test.js Github}
   * @memberOf wsemi
   * @example
   *
   * let ev = wsemi.evem()
   * ev.on('evName',function(msg){
   *     console.log(msg)
   *     // => {abc: 12.34}
   * })
   * let data = {abc:12.34}
   * ev.emit('evName',data)
   *
   */

  function evem() {
    return new eventemitter3();
  }

  /**
   * 判斷是否為字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isstr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isstr(0))
   * // => false
   *
   * console.log(isstr('0'))
   * // => true
   *
   * console.log(isstr(''))
   * // => true
   *
   */
  function isstr(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object String]';
  }

  /**
   * 判斷是否為有效字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isestr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isestr('1.25'))
   * // => true
   *
   * console.log(isestr(125))
   * // => false
   *
   * console.log(isestr(''))
   * // => false
   *
   */

  function isestr(v) {
    //check
    if (isstr(v)) {
      if (v !== '') {
        return true;
      }
    }

    return false;
  }

  /**
   * 判斷是否為物件
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isobj.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isobj({}))
   * // => true
   *
   * console.log(isobj({ a: 123 }))
   * // => true
   *
   */
  function isobj(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Object]';
  }

  /**
   * 判斷是否為有效物件
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isobj.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(iseobj({}))
   * // => false
   *
   * console.log(iseobj({ a: 123 }))
   * // => true
   *
   */

  function iseobj(v) {
    if (isobj(v)) {
      for (var k in v) {
        return true;
      }

      return false;
    }

    return false;
  }

  /**
   * 判斷物件是否有key屬性
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/haskey.test.js Github}
   * @memberOf wsemi
   * @param {Object} obj 輸入物件
   * @param {String} key 輸入要查找的key字串
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(haskey({ a: 123, b: 'xyz', c: '45op', d: null }, 'a'))
   * // => true
   *
   */

  function haskey(obj, key) {
    //check
    if (!isobj(obj)) {
      return false;
    }

    if (!isestr(key)) {
      return false;
    }

    return key in obj;
  }

  /** Used to match a single whitespace character. */
  var reWhitespace = /\s/;
  /**
   * Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
   * character of `string`.
   *
   * @private
   * @param {string} string The string to inspect.
   * @returns {number} Returns the index of the last non-whitespace character.
   */

  function trimmedEndIndex(string) {
    var index = string.length;

    while (index-- && reWhitespace.test(string.charAt(index))) {}

    return index;
  }

  var _trimmedEndIndex = trimmedEndIndex;

  /** Used to match leading whitespace. */

  var reTrimStart = /^\s+/;
  /**
   * The base implementation of `_.trim`.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} Returns the trimmed string.
   */

  function baseTrim(string) {
    return string ? string.slice(0, _trimmedEndIndex(string) + 1).replace(reTrimStart, '') : string;
  }

  var _baseTrim = baseTrim;

  /** Used as references for various `Number` constants. */

  var NAN = 0 / 0;
  /** Used to detect bad signed hexadecimal string values. */

  var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
  /** Used to detect binary string values. */

  var reIsBinary = /^0b[01]+$/i;
  /** Used to detect octal string values. */

  var reIsOctal = /^0o[0-7]+$/i;
  /** Built-in method references without a dependency on `root`. */

  var freeParseInt = parseInt;
  /**
   * Converts `value` to a number.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to process.
   * @returns {number} Returns the number.
   * @example
   *
   * _.toNumber(3.2);
   * // => 3.2
   *
   * _.toNumber(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toNumber(Infinity);
   * // => Infinity
   *
   * _.toNumber('3.2');
   * // => 3.2
   */

  function toNumber(value) {
    if (typeof value == 'number') {
      return value;
    }

    if (isSymbol_1(value)) {
      return NAN;
    }

    if (isObject_1(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject_1(other) ? other + '' : other;
    }

    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }

    value = _baseTrim(value);
    var isBinary = reIsBinary.test(value);
    return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
  }

  var toNumber_1 = toNumber;

  /** Used as references for various `Number` constants. */

  var INFINITY = 1 / 0,
      MAX_INTEGER = 1.7976931348623157e+308;
  /**
   * Converts `value` to a finite number.
   *
   * @static
   * @memberOf _
   * @since 4.12.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {number} Returns the converted number.
   * @example
   *
   * _.toFinite(3.2);
   * // => 3.2
   *
   * _.toFinite(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toFinite(Infinity);
   * // => 1.7976931348623157e+308
   *
   * _.toFinite('3.2');
   * // => 3.2
   */

  function toFinite(value) {
    if (!value) {
      return value === 0 ? value : 0;
    }

    value = toNumber_1(value);

    if (value === INFINITY || value === -INFINITY) {
      var sign = value < 0 ? -1 : 1;
      return sign * MAX_INTEGER;
    }

    return value === value ? value : 0;
  }

  var toFinite_1 = toFinite;

  /**
   * Converts `value` to an integer.
   *
   * **Note:** This method is loosely based on
   * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {number} Returns the converted integer.
   * @example
   *
   * _.toInteger(3.2);
   * // => 3
   *
   * _.toInteger(Number.MIN_VALUE);
   * // => 0
   *
   * _.toInteger(Infinity);
   * // => 1.7976931348623157e+308
   *
   * _.toInteger('3.2');
   * // => 3
   */

  function toInteger(value) {
    var result = toFinite_1(value),
        remainder = result % 1;
    return result === result ? remainder ? result - remainder : result : 0;
  }

  var toInteger_1 = toInteger;

  /**
   * Checks if `value` is an integer.
   *
   * **Note:** This method is based on
   * [`Number.isInteger`](https://mdn.io/Number/isInteger).
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an integer, else `false`.
   * @example
   *
   * _.isInteger(3);
   * // => true
   *
   * _.isInteger(Number.MIN_VALUE);
   * // => false
   *
   * _.isInteger(Infinity);
   * // => false
   *
   * _.isInteger('3');
   * // => false
   */

  function isInteger(value) {
    return typeof value == 'number' && value == toInteger_1(value);
  }

  var isInteger_1 = isInteger;

  /**
   * 判斷是否為數字
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isnbr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isnbr(1.25))
   * // => true
   *
   * console.log(isnbr('1.25'))
   * // => false
   *
   */
  function isnbr(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Number]';
  }

  /**
   * 判斷是否為數字
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isnum.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isnum(0))
   * // => true
   *
   * console.log(isnum(1.25))
   * // => true
   *
   * console.log(isnum('-125'))
   * // => true
   *
   */

  function isnum(v) {
    var b = false;

    if (isestr(v)) {
      b = !isNaN(Number(v));
    } else if (isnbr(v)) {
      b = true;
    }

    return b;
  }

  /**
   * 數字或字串轉浮點數
   * 若輸入非數字則回傳0
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/cdbl.test.js Github}
   * @memberOf wsemi
   * @param {Number|String} v 輸入數字或字串
   * @returns {Number} 回傳數字
   * @example
   *
   * console.log(cdbl('25'))
   * // => 25
   *
   */

  function cdbl(v) {
    //check
    if (!isnum(v)) {
      return 0;
    }

    var r = toFinite_1(v);
    return r;
  }

  /**
   * 判斷是否為整數
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isint.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isint('1.25'))
   * // => false
   *
   * console.log(isint('125'))
   * // => true
   *
   * console.log(isint(1.25))
   * // => false
   *
   * console.log(isint(125))
   * // => true
   *
   */

  function isint(v) {
    if (isnum(v)) {
      v = cdbl(v);
      return isInteger_1(v);
    } else {
      return false;
    }
  }

  /* Built-in method references for those with the same name as other `lodash` methods. */

  var nativeIsFinite = _root.isFinite,
      nativeMin = Math.min;
  /**
   * Creates a function like `_.round`.
   *
   * @private
   * @param {string} methodName The name of the `Math` method to use when rounding.
   * @returns {Function} Returns the new round function.
   */

  function createRound(methodName) {
    var func = Math[methodName];
    return function (number, precision) {
      number = toNumber_1(number);
      precision = precision == null ? 0 : nativeMin(toInteger_1(precision), 292);

      if (precision && nativeIsFinite(number)) {
        // Shift with exponential notation to avoid floating-point issues.
        // See [MDN](https://mdn.io/round#Examples) for more details.
        var pair = (toString_1(number) + 'e').split('e'),
            value = func(pair[0] + 'e' + (+pair[1] + precision));
        pair = (toString_1(value) + 'e').split('e');
        return +(pair[0] + 'e' + (+pair[1] - precision));
      }

      return func(number);
    };
  }

  var _createRound = createRound;

  /**
   * Computes `number` rounded to `precision`.
   *
   * @static
   * @memberOf _
   * @since 3.10.0
   * @category Math
   * @param {number} number The number to round.
   * @param {number} [precision=0] The precision to round to.
   * @returns {number} Returns the rounded number.
   * @example
   *
   * _.round(4.006);
   * // => 4
   *
   * _.round(4.006, 2);
   * // => 4.01
   *
   * _.round(4060, -2);
   * // => 4100
   */

  var round = _createRound('round');
  var round_1 = round;

  /**
   * 數字或字串四捨五入轉整數
   * 若輸入非數字則回傳0
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/cint.test.js Github}
   * @memberOf wsemi
   * @param {Number|String} v 輸入數字或字串
   * @returns {Integer} 回傳四捨五入後整數
   * @example
   *
   * console.log(cint('1.5'))
   * // => 2
   *
   * console.log(cint('-1.5'))
   * // => -1
   *
   */

  function cint(v) {
    //check
    if (!isnum(v)) {
      return 0;
    }

    v = cdbl(v);
    var r = round_1(v); //check -0

    if (String(r) === '0') {
      return 0;
    }

    return r;
  }

  /**
   * 判斷是否為負整數
   * 負整數不包含0，為小於0的整數
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isnint.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isnint(0))
   * // => false
   *
   * console.log(isnint(125))
   * // => false
   *
   * console.log(isnint(-125))
   * // => true
   *
   */

  function isnint(v) {
    //check
    if (!isint(v)) {
      return false;
    }

    var r = cint(v) < 0;
    return r;
  }

  /**
   * 偵測單元是否在線
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/alive.test.js Github}
   * @memberOf wsemi
   * @param {Integer} [timeAlive=10000] 輸入判斷單元是否斷線之延時整數，單位為毫秒ms，預設為10000
   * @returns {Object} 回傳事件物件，可呼叫事件on、trigger、get。trigger給予單元的唯一key字串與攜帶數據data物件，on為監聽事件，需自行監聽message事件取得單元進出事件。get事件可取得alive內視為存活的單元清單
   * @example
   *
   * async function topAsync() {
   *
   *     function test1() {
   *         return new Promise((resolve, reject) => {
   *             let ms = []
   *
   *             let oAL = alive(1500)
   *             let t = new Date()
   *
   *             let a = { data: 123 }
   *             let b = { data: '34.56' }
   *
   *             setTimeout(() => {
   *                 console.log(parseInt((new Date() - t)) + 'ms', 'trigger a1')
   *                 oAL.trigger('a', a)
   *             }, 500)
   *
   *             setTimeout(() => {
   *                 console.log(parseInt((new Date() - t)) + 'ms', 'trigger a2')
   *                 oAL.trigger('a', a)
   *             }, 1900)
   *
   *             setTimeout(() => {
   *                 console.log(parseInt((new Date() - t)) + 'ms', 'trigger b1')
   *                 oAL.trigger('b', b)
   *             }, 1000)
   *
   *             setTimeout(() => {
   *                 console.log(parseInt((new Date() - t)) + 'ms', 'trigger b2')
   *                 oAL.trigger('b', b)
   *             }, 3000)
   *
   *             oAL.on('message', function({ eventName, key, data, now }) {
   *                 console.log(parseInt((new Date() - t)) + 'ms', { eventName, key, data, now })
   *                 ms.push(eventName + '|' + key)
   *             })
   *
   *             setTimeout(() => {
   *                 resolve(ms)
   *             }, 5000)
   *
   *         })
   *     }
   *     console.log('test1')
   *     let r1 = await test1()
   *     console.log(JSON.stringify(r1))
   *     // test1
   *     // 503ms trigger a1
   *     // 508ms { eventName: 'enter', key: 'a', data: { data: 123 }, now: 1 }
   *     // 1001ms trigger b1
   *     // 1003ms { eventName: 'enter', key: 'b', data: { data: '34.56' }, now: 2 }
   *     // 1901ms trigger a2
   *     // 2523ms { eventName: 'leave', key: 'b', data: { data: '34.56' }, now: 1 }
   *     // 3002ms trigger b2
   *     // 3004ms { eventName: 'enter', key: 'b', data: { data: '34.56' }, now: 2 }
   *     // 3430ms { eventName: 'leave', key: 'a', data: { data: 123 }, now: 1 }
   *     // 4544ms { eventName: 'leave', key: 'b', data: { data: '34.56' }, now: 0 }
   *     // ["enter|a","enter|b","leave|b","enter|b","leave|a","leave|b"]
   *
   * }
   * topAsync().catch(() => {})
   *
   */

  function alive() {
    var timeAlive = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10000;
    var ev = evem();
    var q = {}; //queue

    var t = null; //timer
    //check

    if (isnint(timeAlive)) {
      timeAlive = 10000;
    }

    timeAlive = cint(timeAlive);

    function detect() {
      if (t !== null) {
        return;
      }

      t = setInterval(function () {
        //console.log('q', q)
        //detect
        each(q, function (v, key) {
          //t
          var t = Date.now() - v.time; //check, 超過指定延時則視為離開

          if (t > timeAlive) {
            //cloneDeep
            var r = cloneDeep_1(q[key]); //刪除佇列內key紀錄

            delete q[key]; //emit leave

            ev.emit('message', {
              eventName: 'leave',
              key: key,
              data: r.data,
              now: size_1(q)
            });
          }
        }); //clear, 當無任何訊息存在

        if (!iseobj(q)) {
          clearInterval(t);
          t = null;
        }
      }, 50); //50ms偵測, 啟動後跑timer, 無佇列則會停止減耗
    }

    function trigger(key, data) {
      //check
      if (!isestr(key)) {
        console.log('trigger need key');
        return;
      } //check


      if (!haskey(q, key)) {
        setTimeout(function () {
          //因需判斷是否為新單元故需放於update前, 而emit內可能會被存取q, 故需要用setTimeout脫勾使q為被更新資訊, 才能正確取得當前單元數量
          //emit enter
          ev.emit('message', {
            eventName: 'enter',
            key: key,
            data: data,
            now: size_1(q)
          });
        }, 1);
      } //update


      q[key] = {
        data: data,
        time: Date.now()
      }; //detect

      detect();
    }

    function get() {
      var rs = [];
      each(q, function (v, k) {
        rs.push({
          key: k,
          data: v.data
        });
      });
      return rs;
    } //save


    ev.trigger = trigger;
    ev.get = get;
    return ev;
  }

  /**
   * 判斷是否為陣列
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isarr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isarr([]))
   * // => true
   *
   * console.log(isarr([{}]))
   * // => true
   *
   */
  function isarr(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Array]';
  }

  /**
   * 判斷是否為undefined
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isundefined.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isundefined(undefined))
   * // => true
   *
   */
  function isundefined(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Undefined]';
  }

  /**
   * 判斷是否為null
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isnull.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isnull(null))
   * // => true
   *
   */
  function isnull(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Null]';
  }

  /**
   * 判斷是否為空物件
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isobj0.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isobj0({}))
   * // => true
   *
   * console.log(isobj0({ a: 123 }))
   * // => false
   *
   */

  function isobj0(v) {
    if (isobj(v)) {
      for (var k in v) {
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * 判斷是否為空字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isstr0.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isstr0(''))
   * // => true
   *
   * console.log(isstr0('0'))
   * // => false
   *
   * console.log(isstr0('abc125'))
   * // => false
   *
   */

  function isstr0(v) {
    if (isstr(v)) {
      if (v === '') {
        return true;
      }
    }

    return false;
  }

  /**
   * 判斷是否為無內容陣列
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isarr0.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isarr([]))
   * // => true
   *
   * console.log(isarr([{}]))
   * // => false
   *
   */

  function isarr0(v) {
    if (isarr(v)) {
      if (v.length === 0) {
        return true;
      }

      return false;
    }

    return false;
  }

  /**
   * 判斷是否為廣義無效
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/iser.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(iser('12a5'))
   * // => false
   *
   * console.log(iser(''))
   * // => true
   *
   * console.log(iser([]))
   * // => true
   *
   * console.log(iser([{}]))
   * // => false
   *
   * console.log(iser(['']))
   * // => false
   *
   * console.log(iser({}))
   * // => true
   *
   * console.log(iser(null))
   * // => true
   *
   * console.log(iser(undefined))
   * // => true
   *
   */

  function iser(v) {
    if (isundefined(v)) {
      return true;
    }

    if (isnull(v)) {
      return true;
    }

    if (isobj0(v)) {
      return true;
    }

    if (isstr0(v)) {
      return true;
    }

    if (isarr0(v)) {
      return true;
    }

    return false;
  }

  /**
   * 判斷是否為有效陣列，長度至少大於等於1，各元素至少皆為有效
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isearr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isearr([{}]))
   * // => false
   *
   * console.log(isearr([{ a: 123 }]))
   * // => true
   *
   */

  function isearr(v) {
    //check
    if (!isarr(v)) {
      return false;
    } //check length


    if (v.length === 0) {
      return false;
    } //check length=1


    if (v.length === 1) {
      if (iser(v[0])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 判斷是否為ArrayBuffer
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isab.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isab(new ArrayBuffer(1)))
   * // => true
   *
   */
  function isab(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object ArrayBuffer]';
  }

  /**
   * 前端判斷是否為Blob，NodeJS沒有Blob
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isblob.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   * need test in browser
   *
   * let bb = new Blob([new Uint8Array([66, 97, 115])])
   * console.log(isblob(bb))
   * // => true
   *
   */
  function isblob(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Blob]';
  }

  /**
   * 判斷是否為Uint8Array
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isu8arr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isu8arr(new Uint8Array(1)))
   * // => true
   *
   */
  function isu8arr(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Uint8Array]';
  }

  /**
   * 判斷是否為Uint16Array
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isu16arr.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isu16arr(new Uint16Array(1)))
   * // => true
   *
   */
  function isu16arr(v) {
    var c = Object.prototype.toString.call(v);
    return c === '[object Uint16Array]';
  }

  /**
   * 計算Uint8Array(Nodejs,Browser)或Buffer(Nodejs)的大小
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/getBufferSize.test.js Github}
   * @memberOf wsemi
   * @param {Unit8Array|Buffer} buf 傳入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)
   * @returns {Integer} 回傳Uint8Array(Nodejs,Browser)或Buffer(Nodejs)的大小
   * @example
   *
   * let u8a = new Uint8Array([1, 2, 3, 123])
   * console.log(getBufferSize(u8a))
   * // => 4
   *
   * let buf = Buffer.alloc(8)
   * console.log(getBufferSize(buf))
   * // => 8
   *
   */

  function getBufferSize(buf) {
    //check
    if (isab(buf) || isblob(buf) || isu8arr(buf) || isu16arr(buf)) ; else {
      return null;
    } //byteLength


    try {
      if (buf.byteLength) {
        return buf.byteLength;
      }
    } catch (err) {} //length


    try {
      if (buf.length) {
        return buf.length;
      }
    } catch (err) {} //size


    try {
      if (buf.size) {
        return buf.size;
      }
    } catch (err) {}

    return null;
  }

  /** `Object#toString` result references. */

  var objectTag = '[object Object]';
  /** Used for built-in method references. */

  var funcProto = Function.prototype,
      objectProto = Object.prototype;
  /** Used to resolve the decompiled source of functions. */

  var funcToString = funcProto.toString;
  /** Used to check objects for own properties. */

  var hasOwnProperty = objectProto.hasOwnProperty;
  /** Used to infer the `Object` constructor. */

  var objectCtorString = funcToString.call(Object);
  /**
   * Checks if `value` is a plain object, that is, an object created by the
   * `Object` constructor or one with a `[[Prototype]]` of `null`.
   *
   * @static
   * @memberOf _
   * @since 0.8.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   * }
   *
   * _.isPlainObject(new Foo);
   * // => false
   *
   * _.isPlainObject([1, 2, 3]);
   * // => false
   *
   * _.isPlainObject({ 'x': 0, 'y': 0 });
   * // => true
   *
   * _.isPlainObject(Object.create(null));
   * // => true
   */

  function isPlainObject(value) {
    if (!isObjectLike_1(value) || _baseGetTag(value) != objectTag) {
      return false;
    }

    var proto = _getPrototype(value);

    if (proto === null) {
      return true;
    }

    var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
    return typeof Ctor == 'function' && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
  }

  var isPlainObject_1 = isPlainObject;

  /** `Object#toString` result references. */

  var domExcTag = '[object DOMException]',
      errorTag = '[object Error]';
  /**
   * Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
   * `SyntaxError`, `TypeError`, or `URIError` object.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an error object, else `false`.
   * @example
   *
   * _.isError(new Error);
   * // => true
   *
   * _.isError(Error);
   * // => false
   */

  function isError(value) {
    if (!isObjectLike_1(value)) {
      return false;
    }

    var tag = _baseGetTag(value);
    return tag == errorTag || tag == domExcTag || typeof value.message == 'string' && typeof value.name == 'string' && !isPlainObject_1(value);
  }

  var isError_1 = isError;

  /**
   * 物件資料轉字串與Unit8Array，物件內可含Unit8Array數據，適用於大檔。
   *
   * 通過JSON序列化物件內非Unit8Array數據成為字串，另分拆Unit8Array數據出來回傳，兩者間通過指標關聯，主要為避免序列化大型Unit8Array數據造成效能或記憶體不足問題
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/obj2stru8arr.test.js Github}
   * @memberOf wsemi
   * @param {*} data 輸入任意資料
   * @returns {Object} 回傳物件，results欄位儲存物件內非序列化文字，binarys欄位儲存各Unit8Array數據
   * @example
   *
   * let data = {
   *     a: 123,
   *     b: 45.67,
   *     c: 'l1-測試中文',
   *     d: {
   *         da: 123,
   *         db: 45.67,
   *         dc: 'l2-測試中文',
   *         dd: ['a', 'xyz', 321, 76.54],
   *         de: new Uint8Array([66, 97, 115]),
   *     },
   * }
   * let r = obj2stru8arr(data)
   * console.log(r)
   * // => {
   * //     results: '{"a":123,"b":45.67,"c":"l1-測試中文","d":{"da":123,"db":45.67,"dc":"l2-測試中文","dd":["a","xyz",321,76.54],"de":"[Uint8Array]::0"}}',
   * //     binarys: [ Uint8Array [ 66, 97, 115 ] ]
   * // }
   *
   */

  function obj2stru8arr(o) {
    //check
    if (!isobj(o)) {
      return {
        results: '',
        binarys: []
      };
    }

    if (isobj0(o)) {
      return {
        results: '',
        binarys: []
      };
    }

    var r = '';
    var bs = [];

    try {
      //分離u8a或u16a或ab出來
      var i = -1;
      r = JSON.stringify(o, function (key, value) {
        //console.log(key, value)
        if (isu8arr(value)) {
          i += 1;
          var id = "[Uint8Array]::".concat(i);
          bs.push(value);
          return id;
        } else if (isu16arr(value)) {
          i += 1;

          var _id = "[Uint16Array]::".concat(i);

          bs.push(value);
          return _id;
        } else if (isab(value)) {
          i += 1;

          var _id2 = "[ArrayBuffer]::".concat(i);

          bs.push(value);
          return _id2;
        }

        if (isError_1(value)) {
          value = value.toString();
        }

        return value;
      }); // //treeObj, 分離u8a或u16a出來
      // let i = -1
      // let t = treeObj(o, function(key, value) {
      //     //console.log(key, value)
      //     if (isu8arr(value)) {
      //         i += 1
      //         let id = `[Uint8Array]::${i}`
      //         bs.push(value)
      //         return id
      //     }
      //     else if (isu16arr(value)) {
      //         i += 1
      //         let id = `[Uint16Array]::${i}`
      //         bs.push(value)
      //         return id
      //     }
      //     return value
      // })
      // //stringify
      // r = JSON.stringify(t)
    } catch (err) {}

    return {
      results: r,
      binarys: bs
    };
  }

  var core = createCommonjsModule(function (module, exports) {

    (function (root, factory) {
      {
        // CommonJS
        module.exports = factory();
      }
    })(commonjsGlobal, function () {
      /*globals window, global, require*/

      /**
       * CryptoJS core components.
       */
      var CryptoJS = CryptoJS || function (Math, undefined$1) {
        var crypto; // Native crypto from window (Browser)

        if (typeof window !== 'undefined' && window.crypto) {
          crypto = window.crypto;
        } // Native (experimental IE 11) crypto from window (Browser)


        if (!crypto && typeof window !== 'undefined' && window.msCrypto) {
          crypto = window.msCrypto;
        } // Native crypto from global (NodeJS)


        if (!crypto && typeof commonjsGlobal !== 'undefined' && commonjsGlobal.crypto) {
          crypto = commonjsGlobal.crypto;
        } // Native crypto import via require (NodeJS)


        if (!crypto && typeof commonjsRequire === 'function') {
          try {
            crypto = require$$0__default['default'];
          } catch (err) {}
        }
        /*
         * Cryptographically secure pseudorandom number generator
         *
         * As Math.random() is cryptographically not safe to use
         */


        var cryptoSecureRandomInt = function cryptoSecureRandomInt() {
          if (crypto) {
            // Use getRandomValues method (Browser)
            if (typeof crypto.getRandomValues === 'function') {
              try {
                return crypto.getRandomValues(new Uint32Array(1))[0];
              } catch (err) {}
            } // Use randomBytes method (NodeJS)


            if (typeof crypto.randomBytes === 'function') {
              try {
                return crypto.randomBytes(4).readInt32LE();
              } catch (err) {}
            }
          }

          throw new Error('Native crypto module could not be used to get secure random number.');
        };
        /*
         * Local polyfill of Object.create
          */


        var create = Object.create || function () {
          function F() {}

          return function (obj) {
            var subtype;
            F.prototype = obj;
            subtype = new F();
            F.prototype = null;
            return subtype;
          };
        }();
        /**
         * CryptoJS namespace.
         */


        var C = {};
        /**
         * Library namespace.
         */

        var C_lib = C.lib = {};
        /**
         * Base object for prototypal inheritance.
         */

        var Base = C_lib.Base = function () {
          return {
            /**
             * Creates a new object that inherits from this object.
             *
             * @param {Object} overrides Properties to copy into the new object.
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
             */
            extend: function extend(overrides) {
              // Spawn
              var subtype = create(this); // Augment

              if (overrides) {
                subtype.mixIn(overrides);
              } // Create default initializer


              if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
                subtype.init = function () {
                  subtype.$super.init.apply(this, arguments);
                };
              } // Initializer's prototype is the subtype object


              subtype.init.prototype = subtype; // Reference supertype

              subtype.$super = this;
              return subtype;
            },

            /**
             * Extends this object and runs the init method.
             * Arguments to create() will be passed to init().
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var instance = MyType.create();
             */
            create: function create() {
              var instance = this.extend();
              instance.init.apply(instance, arguments);
              return instance;
            },

            /**
             * Initializes a newly created object.
             * Override this method to add some logic when your objects are created.
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
             */
            init: function init() {},

            /**
             * Copies properties into this object.
             *
             * @param {Object} properties The properties to mix in.
             *
             * @example
             *
             *     MyType.mixIn({
             *         field: 'value'
             *     });
             */
            mixIn: function mixIn(properties) {
              for (var propertyName in properties) {
                if (properties.hasOwnProperty(propertyName)) {
                  this[propertyName] = properties[propertyName];
                }
              } // IE won't copy toString using the loop above


              if (properties.hasOwnProperty('toString')) {
                this.toString = properties.toString;
              }
            },

            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = instance.clone();
             */
            clone: function clone() {
              return this.init.prototype.extend(this);
            }
          };
        }();
        /**
         * An array of 32-bit words.
         *
         * @property {Array} words The array of 32-bit words.
         * @property {number} sigBytes The number of significant bytes in this word array.
         */


        var WordArray = C_lib.WordArray = Base.extend({
          /**
           * Initializes a newly created word array.
           *
           * @param {Array} words (Optional) An array of 32-bit words.
           * @param {number} sigBytes (Optional) The number of significant bytes in the words.
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.create();
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
           */
          init: function init(words, sigBytes) {
            words = this.words = words || [];

            if (sigBytes != undefined$1) {
              this.sigBytes = sigBytes;
            } else {
              this.sigBytes = words.length * 4;
            }
          },

          /**
           * Converts this word array to a string.
           *
           * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
           *
           * @return {string} The stringified word array.
           *
           * @example
           *
           *     var string = wordArray + '';
           *     var string = wordArray.toString();
           *     var string = wordArray.toString(CryptoJS.enc.Utf8);
           */
          toString: function toString(encoder) {
            return (encoder || Hex).stringify(this);
          },

          /**
           * Concatenates a word array to this word array.
           *
           * @param {WordArray} wordArray The word array to append.
           *
           * @return {WordArray} This word array.
           *
           * @example
           *
           *     wordArray1.concat(wordArray2);
           */
          concat: function concat(wordArray) {
            // Shortcuts
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes; // Clamp excess bits

            this.clamp(); // Concat

            if (thisSigBytes % 4) {
              // Copy one byte at a time
              for (var i = 0; i < thatSigBytes; i++) {
                var thatByte = thatWords[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
                thisWords[thisSigBytes + i >>> 2] |= thatByte << 24 - (thisSigBytes + i) % 4 * 8;
              }
            } else {
              // Copy one word at a time
              for (var i = 0; i < thatSigBytes; i += 4) {
                thisWords[thisSigBytes + i >>> 2] = thatWords[i >>> 2];
              }
            }

            this.sigBytes += thatSigBytes; // Chainable

            return this;
          },

          /**
           * Removes insignificant bits.
           *
           * @example
           *
           *     wordArray.clamp();
           */
          clamp: function clamp() {
            // Shortcuts
            var words = this.words;
            var sigBytes = this.sigBytes; // Clamp

            words[sigBytes >>> 2] &= 0xffffffff << 32 - sigBytes % 4 * 8;
            words.length = Math.ceil(sigBytes / 4);
          },

          /**
           * Creates a copy of this word array.
           *
           * @return {WordArray} The clone.
           *
           * @example
           *
           *     var clone = wordArray.clone();
           */
          clone: function clone() {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);
            return clone;
          },

          /**
           * Creates a word array filled with random bytes.
           *
           * @param {number} nBytes The number of random bytes to generate.
           *
           * @return {WordArray} The random word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.random(16);
           */
          random: function random(nBytes) {
            var words = [];

            for (var i = 0; i < nBytes; i += 4) {
              words.push(cryptoSecureRandomInt());
            }

            return new WordArray.init(words, nBytes);
          }
        });
        /**
         * Encoder namespace.
         */

        var C_enc = C.enc = {};
        /**
         * Hex encoding strategy.
         */

        var Hex = C_enc.Hex = {
          /**
           * Converts a word array to a hex string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The hex string.
           *
           * @static
           *
           * @example
           *
           *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
           */
          stringify: function stringify(wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes; // Convert

            var hexChars = [];

            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
              hexChars.push((bite >>> 4).toString(16));
              hexChars.push((bite & 0x0f).toString(16));
            }

            return hexChars.join('');
          },

          /**
           * Converts a hex string to a word array.
           *
           * @param {string} hexStr The hex string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
           */
          parse: function parse(hexStr) {
            // Shortcut
            var hexStrLength = hexStr.length; // Convert

            var words = [];

            for (var i = 0; i < hexStrLength; i += 2) {
              words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << 24 - i % 8 * 4;
            }

            return new WordArray.init(words, hexStrLength / 2);
          }
        };
        /**
         * Latin1 encoding strategy.
         */

        var Latin1 = C_enc.Latin1 = {
          /**
           * Converts a word array to a Latin1 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Latin1 string.
           *
           * @static
           *
           * @example
           *
           *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
           */
          stringify: function stringify(wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes; // Convert

            var latin1Chars = [];

            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
              latin1Chars.push(String.fromCharCode(bite));
            }

            return latin1Chars.join('');
          },

          /**
           * Converts a Latin1 string to a word array.
           *
           * @param {string} latin1Str The Latin1 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
           */
          parse: function parse(latin1Str) {
            // Shortcut
            var latin1StrLength = latin1Str.length; // Convert

            var words = [];

            for (var i = 0; i < latin1StrLength; i++) {
              words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << 24 - i % 4 * 8;
            }

            return new WordArray.init(words, latin1StrLength);
          }
        };
        /**
         * UTF-8 encoding strategy.
         */

        var Utf8 = C_enc.Utf8 = {
          /**
           * Converts a word array to a UTF-8 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-8 string.
           *
           * @static
           *
           * @example
           *
           *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
           */
          stringify: function stringify(wordArray) {
            try {
              return decodeURIComponent(escape(Latin1.stringify(wordArray)));
            } catch (e) {
              throw new Error('Malformed UTF-8 data');
            }
          },

          /**
           * Converts a UTF-8 string to a word array.
           *
           * @param {string} utf8Str The UTF-8 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
           */
          parse: function parse(utf8Str) {
            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
          }
        };
        /**
         * Abstract buffered block algorithm template.
         *
         * The property blockSize must be implemented in a concrete subtype.
         *
         * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
         */

        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
          /**
           * Resets this block algorithm's data buffer to its initial state.
           *
           * @example
           *
           *     bufferedBlockAlgorithm.reset();
           */
          reset: function reset() {
            // Initial values
            this._data = new WordArray.init();
            this._nDataBytes = 0;
          },

          /**
           * Adds new data to this block algorithm's buffer.
           *
           * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
           *
           * @example
           *
           *     bufferedBlockAlgorithm._append('data');
           *     bufferedBlockAlgorithm._append(wordArray);
           */
          _append: function _append(data) {
            // Convert string to WordArray, else assume WordArray already
            if (typeof data == 'string') {
              data = Utf8.parse(data);
            } // Append


            this._data.concat(data);

            this._nDataBytes += data.sigBytes;
          },

          /**
           * Processes available data blocks.
           *
           * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
           *
           * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
           *
           * @return {WordArray} The processed data.
           *
           * @example
           *
           *     var processedData = bufferedBlockAlgorithm._process();
           *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
           */
          _process: function _process(doFlush) {
            var processedWords; // Shortcuts

            var data = this._data;
            var dataWords = data.words;
            var dataSigBytes = data.sigBytes;
            var blockSize = this.blockSize;
            var blockSizeBytes = blockSize * 4; // Count blocks ready

            var nBlocksReady = dataSigBytes / blockSizeBytes;

            if (doFlush) {
              // Round up to include partial blocks
              nBlocksReady = Math.ceil(nBlocksReady);
            } else {
              // Round down to include only full blocks,
              // less the number of blocks that must remain in the buffer
              nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
            } // Count words ready


            var nWordsReady = nBlocksReady * blockSize; // Count bytes ready

            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes); // Process blocks

            if (nWordsReady) {
              for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                // Perform concrete-algorithm logic
                this._doProcessBlock(dataWords, offset);
              } // Remove processed words


              processedWords = dataWords.splice(0, nWordsReady);
              data.sigBytes -= nBytesReady;
            } // Return processed words


            return new WordArray.init(processedWords, nBytesReady);
          },

          /**
           * Creates a copy of this object.
           *
           * @return {Object} The clone.
           *
           * @example
           *
           *     var clone = bufferedBlockAlgorithm.clone();
           */
          clone: function clone() {
            var clone = Base.clone.call(this);
            clone._data = this._data.clone();
            return clone;
          },
          _minBufferSize: 0
        });
        /**
         * Abstract hasher template.
         *
         * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
         */

        C_lib.Hasher = BufferedBlockAlgorithm.extend({
          /**
           * Configuration options.
           */
          cfg: Base.extend(),

          /**
           * Initializes a newly created hasher.
           *
           * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
           *
           * @example
           *
           *     var hasher = CryptoJS.algo.SHA256.create();
           */
          init: function init(cfg) {
            // Apply config defaults
            this.cfg = this.cfg.extend(cfg); // Set initial values

            this.reset();
          },

          /**
           * Resets this hasher to its initial state.
           *
           * @example
           *
           *     hasher.reset();
           */
          reset: function reset() {
            // Reset data buffer
            BufferedBlockAlgorithm.reset.call(this); // Perform concrete-hasher logic

            this._doReset();
          },

          /**
           * Updates this hasher with a message.
           *
           * @param {WordArray|string} messageUpdate The message to append.
           *
           * @return {Hasher} This hasher.
           *
           * @example
           *
           *     hasher.update('message');
           *     hasher.update(wordArray);
           */
          update: function update(messageUpdate) {
            // Append
            this._append(messageUpdate); // Update the hash


            this._process(); // Chainable


            return this;
          },

          /**
           * Finalizes the hash computation.
           * Note that the finalize operation is effectively a destructive, read-once operation.
           *
           * @param {WordArray|string} messageUpdate (Optional) A final message update.
           *
           * @return {WordArray} The hash.
           *
           * @example
           *
           *     var hash = hasher.finalize();
           *     var hash = hasher.finalize('message');
           *     var hash = hasher.finalize(wordArray);
           */
          finalize: function finalize(messageUpdate) {
            // Final message update
            if (messageUpdate) {
              this._append(messageUpdate);
            } // Perform concrete-hasher logic


            var hash = this._doFinalize();

            return hash;
          },
          blockSize: 512 / 32,

          /**
           * Creates a shortcut function to a hasher's object interface.
           *
           * @param {Hasher} hasher The hasher to create a helper for.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
           */
          _createHelper: function _createHelper(hasher) {
            return function (message, cfg) {
              return new hasher.init(cfg).finalize(message);
            };
          },

          /**
           * Creates a shortcut function to the HMAC's object interface.
           *
           * @param {Hasher} hasher The hasher to use in this HMAC helper.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
           */
          _createHmacHelper: function _createHmacHelper(hasher) {
            return function (message, key) {
              return new C_algo.HMAC.init(hasher, key).finalize(message);
            };
          }
        });
        /**
         * Algorithm namespace.
         */

        var C_algo = C.algo = {};
        return C;
      }(Math);

      return CryptoJS;
    });
  });

  var encUtf8 = createCommonjsModule(function (module, exports) {

    (function (root, factory) {
      {
        // CommonJS
        module.exports = factory(core);
      }
    })(commonjsGlobal, function (CryptoJS) {
      return CryptoJS.enc.Utf8;
    });
  });

  var encBase64 = createCommonjsModule(function (module, exports) {

    (function (root, factory) {
      {
        // CommonJS
        module.exports = factory(core);
      }
    })(commonjsGlobal, function (CryptoJS) {
      (function () {
        // Shortcuts
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_enc = C.enc;
        /**
         * Base64 encoding strategy.
         */

        C_enc.Base64 = {
          /**
           * Converts a word array to a Base64 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Base64 string.
           *
           * @static
           *
           * @example
           *
           *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
           */
          stringify: function stringify(wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map; // Clamp excess bits

            wordArray.clamp(); // Convert

            var base64Chars = [];

            for (var i = 0; i < sigBytes; i += 3) {
              var byte1 = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
              var byte2 = words[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 0xff;
              var byte3 = words[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 0xff;
              var triplet = byte1 << 16 | byte2 << 8 | byte3;

              for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
                base64Chars.push(map.charAt(triplet >>> 6 * (3 - j) & 0x3f));
              }
            } // Add padding


            var paddingChar = map.charAt(64);

            if (paddingChar) {
              while (base64Chars.length % 4) {
                base64Chars.push(paddingChar);
              }
            }

            return base64Chars.join('');
          },

          /**
           * Converts a Base64 string to a word array.
           *
           * @param {string} base64Str The Base64 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
           */
          parse: function parse(base64Str) {
            // Shortcuts
            var base64StrLength = base64Str.length;
            var map = this._map;
            var reverseMap = this._reverseMap;

            if (!reverseMap) {
              reverseMap = this._reverseMap = [];

              for (var j = 0; j < map.length; j++) {
                reverseMap[map.charCodeAt(j)] = j;
              }
            } // Ignore padding


            var paddingChar = map.charAt(64);

            if (paddingChar) {
              var paddingIndex = base64Str.indexOf(paddingChar);

              if (paddingIndex !== -1) {
                base64StrLength = paddingIndex;
              }
            } // Convert


            return parseLoop(base64Str, base64StrLength, reverseMap);
          },
          _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
        };

        function parseLoop(base64Str, base64StrLength, reverseMap) {
          var words = [];
          var nBytes = 0;

          for (var i = 0; i < base64StrLength; i++) {
            if (i % 4) {
              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << i % 4 * 2;
              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> 6 - i % 4 * 2;
              var bitsCombined = bits1 | bits2;
              words[nBytes >>> 2] |= bitsCombined << 24 - nBytes % 4 * 8;
              nBytes++;
            }
          }

          return WordArray.create(words, nBytes);
        }
      })();

      return CryptoJS.enc.Base64;
    });
  });

  /**
   * 一般字串轉base64字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/str2b64.test.js Github}
   * @memberOf wsemi
   * @param {String} str 輸入一般字串
   * @returns {String} 回傳base64字串
   * @example
   *
   * console.log(str2b64('test中文'))
   * // => 'dGVzdOS4reaWhw=='
   *
   */

  function str2b64(str) {
    //check
    if (!isestr(str)) {
      return '';
    }

    var words = encUtf8.parse(str);
    var base64 = encBase64.stringify(words);
    return base64;
  }

  /**
   * base64字串轉Uint8Array
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/b642u8arr.test.js Github}
   * @memberOf wsemi
   * @param {String} b64 輸入base64字串
   * @returns {Uint8Array} 回傳Uint8Array
   * @example
   *
   * console.log(b642u8arr('AQItAA=='))
   * // => new Uint8Array([1, 2.3, '45', 'abc'])
   *
   */

  function b642u8arr(b64) {
    //check
    if (!isstr(b64)) {
      return new Uint8Array();
    }

    var wa = encBase64.parse(b64); //words, sigBytes

    var words = wa.words;
    var sigBytes = wa.sigBytes; //u8a

    var u8a = new Uint8Array(sigBytes);

    for (var i = 0; i < sigBytes; i++) {
      var byte = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
      u8a[i] = byte;
    }

    return u8a;
  }

  /**
   * 字串轉Uint8Array
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/str2u8arr.test.js Github}
   * @memberOf wsemi
   * @param {String} str 輸入一般字串
   * @returns {Uint8Array} 回傳Uint8Array
   * @example
   *
   * console.log(str2u8arr('test中文'))
   * // => Uint8Array [116, 101, 115, 116, 228, 184, 173, 230, 150, 135]
   *
   */

  function str2u8arr(str) {
    //check
    if (!isestr(str)) {
      return new Uint8Array();
    } //r


    var r;

    try {
      r = b642u8arr(str2b64(str));
    } catch (err) {
      return new Uint8Array();
    }

    return r;
  }

  /** `Object#toString` result references. */

  var boolTag = '[object Boolean]';
  /**
   * Checks if `value` is classified as a boolean primitive or object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
   * @example
   *
   * _.isBoolean(false);
   * // => true
   *
   * _.isBoolean(null);
   * // => false
   */

  function isBoolean(value) {
    return value === true || value === false || isObjectLike_1(value) && _baseGetTag(value) == boolTag;
  }

  var isBoolean_1 = isBoolean;

  /**
   * 判斷是否為boolean
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/isbol.test.js Github}
   * @memberOf wsemi
   * @param {*} v 輸入任意資料
   * @returns {Boolean} 回傳判斷布林值
   * @example
   *
   * console.log(isbol(false))
   * // => true
   *
   */

  function isbol(v) {
    return isBoolean_1(v);
  }

  /**
   * 寫入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   *
   * Fork: {@link https://github.com/toots/buffer-browserify/blob/master/buffer_ieee754.js buffer_ieee754}
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/bufWrite.test.js Github}
   * @memberOf wsemi
   * @param {Number} value 輸入數字
   * @param {Uint8Array|Buffer} buffer 輸入被寫入的Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   * @param {Integer} offset 輸入平移整數
   * @param {Boolean} isBE 輸入是否為大端序Big-Endian
   * @param {Integer} mLen 輸入有效位數整數
   * @param {Integer} nBytes 輸入使用位元組整數
   * @example
   *
   * let offset = 0
   * let isBE = true
   * let mLen = 52
   * let nBytes = 8
   *
   * let i = 1447656645380 //new Uint8Array([66, 117, 16, 240, 246, 48, 64, 0])
   * let b = Buffer.alloc(8)
   * bufWrite(i, b, offset, isBE, mLen, nBytes)
   * console.log(b)
   * // >= <Buffer 42 75 10 f0 f6 30 40 00>
   * console.log(new Uint8Array(b))
   * // => Uint8Array [66, 117, 16, 240, 246, 48, 64, 0]
   *
   */

  function bufWrite(value, buffer, offset, isBE, mLen, nBytes) {
    //check
    if (!isnum(value)) {
      return null;
    }

    if (!isu8arr(buffer)) {
      return null;
    }

    if (!isint(offset)) {
      return null;
    }

    if (!isbol(isBE)) {
      return null;
    }

    if (!isint(mLen)) {
      return null;
    }

    if (!isint(nBytes)) {
      return null;
    } //cdbl


    value = cdbl(value);
    var e;
    var m;
    var c;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
    var i = isBE ? nBytes - 1 : 0;
    var d = isBE ? -1 : 1;
    var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
    value = Math.abs(value);

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0;
      e = eMax;
    } else {
      e = Math.floor(Math.log(value) / Math.LN2);

      if (value * (c = Math.pow(2, -e)) < 1) {
        e--;
        c *= 2;
      }

      if (e + eBias >= 1) {
        value += rt / c;
      } else {
        value += rt * Math.pow(2, 1 - eBias);
      }

      if (value * c >= 2) {
        e++;
        c /= 2;
      }

      if (e + eBias >= eMax) {
        m = 0;
        e = eMax;
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen);
        e = e + eBias;
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
        e = 0;
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {
    }

    e = e << mLen | m;
    eLen += mLen;

    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {
    }

    buffer[offset + i - d] |= s * 128;
    return null;
  }

  /**
   * 寫入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)內的浮點數資料，需先依照nBytes宣告Uint8Array或Buffer空間
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/bufWriteDbl.test.js Github}
   * @memberOf wsemi
   * @param {Number} value 輸入數字
   * @param {Uint8Array|Buffer} buffer 輸入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   * @param {Integer} [offset=0] 輸入平移整數，預設0
   * @param {Boolean} [isBE=true] 輸入是否為大端序Big-Endian，預設true
   * @param {Integer} [mLen=52] 輸入有效位數整數，預設52
   * @param {Integer} [nBytes=8] 輸入使用位元組整數，預設8
   * @returns {Number} 回傳數字
   * @example
   *
   * let i = 1447656645380 //new Uint8Array([66, 117, 16, 240, 246, 48, 64, 0])
   * let b = Buffer.alloc(8)
   * bufWriteDbl(i, b)
   * console.log(b)
   * // >= <Buffer 42 75 10 f0 f6 30 40 00>
   * console.log(new Uint8Array(b))
   * // => Uint8Array [66, 117, 16, 240, 246, 48, 64, 0]
   *
   */

  function bufWriteDbl(value, buffer) {
    var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var isBE = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var mLen = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 52;
    var nBytes = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 8;
    return bufWrite(value, buffer, offset, isBE, mLen, nBytes);
  }

  //     return Uint8Array.from([...a, ...b])
  // }

  function concatU8arr(a, b) {
    var ia = getBufferSize(a);
    var ib = getBufferSize(b);
    var tmp = new Uint8Array(ia + ib);
    tmp.set(new Uint8Array(a), 0);
    tmp.set(new Uint8Array(b), ia);
    return tmp;
  }
  /**
   * 物件或陣列資料轉Uint8Array
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/obj2u8arr.test.js Github}
   * @memberOf wsemi
   * @param {Object|Array} data 輸入物件或陣列資料，物件內可支援Uint8Array、Uint16Array、ArrayBuffer，注意因ArrayBuffer無法直接操作(非View，只有TypedArray與DataView可操作)故預設會轉Uint8Array進行處理
   * @returns {Uint8Array} 回傳Uint8Array
   * @example
   *
   * let data = {
   *     a: [123, 45.67, 'test中文'],
   *     b: {
   *         c: new Uint8Array([66, 97, 115]),
   *     },
   * }
   * let u8a = obj2u8arr(data)
   * console.log(u8a)
   * // => Uint8Array [
   * //     64,  24,   0,   0,   0,  0,  0,   0,  91,  53,  56,  44,
   * //     51,  93, 123,  34,  97, 34, 58,  91,  49,  50,  51,  44,
   * //     52,  53,  46,  54,  55, 44, 34, 116, 101, 115, 116, 228,
   * //    184, 173, 230, 150, 135, 34, 93,  44,  34,  98,  34,  58,
   * //    123,  34,  99,  34,  58, 34, 91,  85, 105, 110, 116,  56,
   * //     65, 114, 114,  97, 121, 93, 58,  58,  48,  34, 125, 125,
   * //     66,  97, 115
   * // ]
   *
   */


  function obj2u8arr(data) {
    var bs = [];
    var r = []; //check

    if (!isearr(data) && !iseobj(data)) {
      return null;
    } //addBin


    var pkLens = [];
    var pkBins = [];

    function addBin(b) {
      pkLens.push(getBufferSize(b));
      pkBins.push(b);
    }

    try {
      //obj2stru8arr
      var sb = obj2stru8arr(data); //序列化數據, 分別為無Uint8Array序列化字串(results), 以及各Uint8Array數據(binarys)
      //console.log('sb', sb)
      //sb.results

      var bMain = str2u8arr(sb.results); //無Uint8Array序列化字串轉二進位數據(Uint8Array)

      addBin(bMain); //加入無Uint8Array序列化字串二進位數據(Uint8Array)
      //sb.binarys

      each(sb.binarys, function (b) {
        addBin(b); //加入各分塊二進位數據(Uint8Array)
      }); //bPks

      var vPks = pkLens; //各分塊長度資訊

      var bPks = str2u8arr(JSON.stringify(vPks)); //各分塊長度資訊序列化成字串, 再轉二進位數據(Uint8Array)
      //push head

      var ibHead = 8; //預設用開頭8 bytes來儲存分塊資訊之長度

      var bHead = new Uint8Array(ibHead); //宣告

      bufWriteDbl(getBufferSize(bPks), bHead); //寫入分塊資訊之長度

      bs.push(bHead); //推入開頭儲存分塊資訊之長度
      //push

      bs.push(bPks); //推入各分塊資訊長度陣列
      //push

      each(pkBins, function (b) {
        bs.push(b); //推入各分塊資訊
      }); //flatten

      each(bs, function (b) {
        r = concatU8arr(r, b); //合併各二進位數據
      });
    } catch (err) {
      return null;
    }

    return r;
  }

  /**
   * 讀取Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   *
   * Fork: {@link https://github.com/toots/buffer-browserify/blob/master/buffer_ieee754.js buffer_ieee754}
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/bufRead.test.js Github}
   * @memberOf wsemi
   * @param {Uint8Array|Buffer} buffer 輸入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   * @param {Integer} offset 輸入平移整數
   * @param {Boolean} isBE 輸入是否為大端序Big-Endian
   * @param {Integer} mLen 輸入有效位數整數
   * @param {Integer} nBytes 輸入使用位元組整數
   * @returns {Number} 回傳數字
   * @example
   *
   * let offset = 0
   * let isBE = true
   * let mLen = 52
   * let nBytes = 8
   * let b = new Uint8Array([66, 117, 16, 240, 246, 48, 64, 0]) //1447656645380
   * let j = bufRead(b, offset, isBE, mLen, nBytes)
   * console.log(j)
   * // => 1447656645380
   *
   */

  function bufRead(buffer, offset, isBE, mLen, nBytes) {
    //check
    if (!isu8arr(buffer)) {
      return null;
    }

    if (!isint(offset)) {
      return null;
    }

    if (!isbol(isBE)) {
      return null;
    }

    if (!isint(mLen)) {
      return null;
    }

    if (!isint(nBytes)) {
      return null;
    }

    var e;
    var m;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var nBits = -7;
    var i = isBE ? 0 : nBytes - 1;
    var d = isBE ? 1 : -1;
    var s = buffer[offset + i];
    i += d;
    e = s & (1 << -nBits) - 1;
    s >>= -nBits;
    nBits += eLen;

    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
    }

    m = e & (1 << -nBits) - 1;
    e >>= -nBits;
    nBits += mLen;

    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
    }

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : (s ? -1 : 1) * Infinity;
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }

    return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
  }

  /**
   * 讀取Uint8Array(Nodejs,Browser)或Buffer(Nodejs)內的浮點數資料
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/bufReadDbl.test.js Github}
   * @memberOf wsemi
   * @param {Uint8Array|Buffer} buffer 輸入Uint8Array(Nodejs,Browser)或Buffer(Nodejs)資料
   * @param {Integer} [offset=0] 輸入平移整數，預設0
   * @param {Boolean} [isBE=true] 輸入是否為大端序Big-Endian，預設true
   * @param {Integer} [mLen=52] 輸入有效位數整數，預設52
   * @param {Integer} [nBytes=8] 輸入使用位元組整數，預設8
   * @returns {Number} 回傳數字
   * @example
   *
   * let b = new Uint8Array([66, 117, 16, 240, 246, 48, 64, 0]) //1447656645380
   * let j = bufReadDbl(b)
   * console.log(j)
   * // => 1447656645380
   *
   */

  function bufReadDbl(buffer) {
    var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var isBE = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var mLen = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 52;
    var nBytes = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 8;
    return bufRead(buffer, offset, isBE, mLen, nBytes);
  }

  var libTypedarrays = createCommonjsModule(function (module, exports) {

    (function (root, factory) {
      {
        // CommonJS
        module.exports = factory(core);
      }
    })(commonjsGlobal, function (CryptoJS) {
      (function () {
        // Check if typed arrays are supported
        if (typeof ArrayBuffer != 'function') {
          return;
        } // Shortcuts


        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray; // Reference original init

        var superInit = WordArray.init; // Augment WordArray.init to handle typed arrays

        var subInit = WordArray.init = function (typedArray) {
          // Convert buffers to uint8
          if (typedArray instanceof ArrayBuffer) {
            typedArray = new Uint8Array(typedArray);
          } // Convert other array views to uint8


          if (typedArray instanceof Int8Array || typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray || typedArray instanceof Int16Array || typedArray instanceof Uint16Array || typedArray instanceof Int32Array || typedArray instanceof Uint32Array || typedArray instanceof Float32Array || typedArray instanceof Float64Array) {
            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
          } // Handle Uint8Array


          if (typedArray instanceof Uint8Array) {
            // Shortcut
            var typedArrayByteLength = typedArray.byteLength; // Extract bytes

            var words = [];

            for (var i = 0; i < typedArrayByteLength; i++) {
              words[i >>> 2] |= typedArray[i] << 24 - i % 4 * 8;
            } // Initialize this word array


            superInit.call(this, words, typedArrayByteLength);
          } else {
            // Else call normal init
            superInit.apply(this, arguments);
          }
        };

        subInit.prototype = WordArray;
      })();

      return CryptoJS.lib.WordArray;
    });
  });

  /**
   * Uint8Array轉base64字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/u8arr2b64.test.js Github}
   * @memberOf wsemi
   * @param {Uint8Array} u8a 輸入Uint8Array
   * @returns {String} 回傳base64字串
   * @example
   *
   * console.log(u8arr2b64(new Uint8Array([1, 2.3, '45', 'abc'])))
   * // => 'AQItAA=='
   *
   */

  function u8arr2b64(u8a) {
    //check
    if (!isu8arr(u8a)) {
      return '';
    }

    var wa = libTypedarrays.create(u8a);
    var b64 = wa.toString(encBase64);
    return b64;
  }

  /**
   * base64字串轉一般字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/b642str.test.js Github}
   * @memberOf wsemi
   * @param {String} b64 輸入base64字串
   * @returns {String} 回傳一般字串
   * @example
   *
   * console.log(b642str('dGVzdOS4reaWhw=='))
   * // => 'test中文'
   *
   */

  function b642str(b64) {
    //check
    if (!isestr(b64)) {
      return '';
    }

    var wa = encBase64.parse(b64);
    var str = wa.toString(encUtf8);
    return str;
  }

  /**
   * Uint8Array轉字串
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/u8arr2str.test.js Github}
   * @memberOf wsemi
   * @param {Uint8Array} u8a 輸入Uint8Array
   * @returns {String} 回傳一般字串
   * @example
   *
   * console.log(u8arr2str(new Uint8Array([116, 101, 115, 116, 228, 184, 173, 230, 150, 135])))
   * // => test中文
   *
   */

  function u8arr2str(u8a) {
    //check
    if (!isu8arr(u8a)) {
      return '';
    } //r


    var r;

    try {
      r = b642str(u8arr2b64(u8a));
    } catch (err) {
      return '';
    }

    return r;
  }

  /**
   * 由字串與Unit8Array陣列轉物件，為對obj2stru8arr序列化之數據進行反序列化
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/stru8arr2obj.test.js Github}
   * @memberOf wsemi
   * @param {String} data.results 輸入待反序列化字串
   * @param {Array} data.binarys 輸入Unit8Array陣列
   * @returns {*} 回傳任意物件
   * @example
   *
   * let r = {
   *     results: '{"a":123,"b":45.67,"c":"l1-測試中文","d":{"da":123,"db":45.67,"dc":"l2-測試中文","dd":["a","xyz",321,76.54],"de":"[Uint8Array]::0"}}',
   *     binarys: [new Uint8Array([66, 97, 115])]
   * }
   * let data = stru8arr2obj(r)
   * console.log(data)
   * // => {
   * //     a: 123,
   * //     b: 45.67,
   * //     c: 'l1-測試中文',
   * //     d: {
   * //         da: 123,
   * //         db: 45.67,
   * //         dc: 'l2-測試中文',
   * //         dd: [ 'a', 'xyz', 321, 76.54 ],
   * //         de: Uint8Array [ 66, 97, 115 ]
   * //     }
   * // }
   *
   */

  function stru8arr2obj(data) {
    //check
    if (!iseobj(data)) {
      return {};
    } //results, binarys


    var results = data.results,
        binarys = data.binarys; //check

    if (!isestr(results)) {
      return {};
    }

    if (!isarr(binarys)) {
      return {};
    }

    var o = {};

    try {
      o = JSON.parse(results, function (key, value) {
        if (isestr(value)) {
          if (value.indexOf('[Uint8Array]::') >= 0) {
            var id = cint(value.replace('[Uint8Array]::', ''));
            return binarys[id];
          } else if (value.indexOf('[Uint16Array]::') >= 0) {
            var _id = cint(value.replace('[Uint16Array]::', ''));

            return binarys[_id];
          } else if (value.indexOf('[ArrayBuffer]::') >= 0) {
            var _id2 = cint(value.replace('[ArrayBuffer]::', ''));

            return binarys[_id2];
          }
        }

        return value;
      });
    } catch (err) {}

    return o;
  }

  function sliceU8arr(u8a, inds) {
    var i = 0;
    var j = 0;
    var r = [];
    each(inds, function (ind) {
      j = i + ind;
      var t = u8a.slice(i, j);
      i = j;
      r.push(t);
    });
    return r;
  }
  /**
   * Uint8Array轉物件或陣列資料
   *
   * Unit Test: {@link https://github.com/yuda-lyu/wsemi/blob/master/test/u8arr2obj.test.js Github}
   * @memberOf wsemi
   * @param {Uint8Array} u8a 輸入Uint8Array
   * @returns {Object|Array} 回傳物件或陣列資料，物件內可支援Uint8Array、Uint16Array、ArrayBuffer，因obj2u8arr預設會把ArrayBuffer轉Uint8Array進行操作，故物件內原為ArrayBuffer者會以Uint8Array返回
   * @example
   *
   * let u8a = new Uint8Array([
   *     64, 24, 0, 0, 0, 0, 0, 0, 91, 53, 56, 44,
   *     51, 93, 123, 34, 97, 34, 58, 91, 49, 50, 51, 44,
   *     52, 53, 46, 54, 55, 44, 34, 116, 101, 115, 116, 228,
   *     184, 173, 230, 150, 135, 34, 93, 44, 34, 98, 34, 58,
   *     123, 34, 99, 34, 58, 34, 91, 85, 105, 110, 116, 56,
   *     65, 114, 114, 97, 121, 93, 58, 58, 48, 34, 125, 125,
   *     66, 97, 115
   * ])
   * let data = u8arr2obj(u8a)
   * console.log(data)
   * // => { a: [ 123, 45.67, 'test中文' ], b: { c: Uint8Array [ 66, 97, 115 ] } }
   *
   */


  function u8arr2obj(u8a) {
    var data = null; //check

    if (!isu8arr(u8a)) {
      return null;
    }

    try {
      //bHead, bOthers
      var ibHead = 8; //預設用開頭8 bytes來儲存分塊資訊區之長度

      var bHead = u8a.slice(0, ibHead); //分塊資訊區長度之二進位數據(Uint8Array)

      var bOthers = u8a.slice(ibHead, getBufferSize(u8a)); //其他之二進位數據(Uint8Array)
      //lenHead

      var lenHead = bufReadDbl(bHead); //讀取分塊資訊區長度

      var bvPks = bOthers.slice(0, lenHead); //分塊資訊區之二進位數據(Uint8Array)

      var bbPks = bOthers.slice(lenHead, getBufferSize(bOthers)); //各分塊區之二進位數據(Uint8Array)
      //vPks

      var cvPks = u8arr2str(bvPks); //取得分塊資訊區二進位數據(Uint8Array)內文字

      var vPks = JSON.parse(cvPks); //算得分塊資訊, 為陣列, 各元素代表各分塊長度
      //bPks

      var bPks = sliceU8arr(bbPks, vPks); //依照各分塊長度切出分各分塊之二進位數據(Uint8Array)
      //results, to sb.results

      var bMain = bPks.shift(); //bPks[0], 第1區塊為無Uint8Array序列化字串之二進位數據(Uint8Array)

      var results = u8arr2str(bMain); //取得無Uint8Array序列化字串
      //binarys , to sb.binarys

      var binarys = bPks; //others, 其他塊皆為Uint8Array之二進位數據(Uint8Array)
      //data

      data = stru8arr2obj({
        results: results,
        binarys: binarys
      }); //反序列化數據, 由無Uint8Array序列化字串與Uint8Array之二進位數據算得原本資料
    } catch (err) {}

    return data;
  }

  /**
   * 建立Hapi伺服器
   *
   * @class
   * @param {Object} [opt={}] 輸入設定物件，預設{}
   * @param {Integer} [opt.port=8080] 輸入Hapi伺服器所在port，預設8080
   * @param {String} [opt.apiName='api'] 輸入http API伺服器網址的api名稱，預設'api'
   * @returns {Object} 回傳通訊物件，可監聽事件open、error、clientChange、execute、broadcast、deliver，可使用函數broadcast
   * @example
   *
   * import WConverhpServer from 'w-converhp/dist/w-converhp-server.umd.js'
   *
   * let opt = {
   *     port: 8080,
   *     apiName: 'api',
   * }
   *
   * //new
   * let wo = new WConverhpServer(opt)
   *
   * wo.on('open', function() {
   *     console.log(`Server[port:${opt.port}]: open`)
   *
   *     //broadcast
   *     let n = 0
   *     setInterval(() => {
   *         n += 1
   *         let o = {
   *             text: `server broadcast hi(${n})`,
   *             data: new Uint8Array([66, 97, 115]), //support Uint8Array data
   *         }
   *         wo.broadcast(o, function (prog) {
   *             console.log('broadcast prog', prog)
   *         })
   *     }, 1000)
   *
   * })
   * wo.on('error', function(err) {
   *     console.log(`Server[port:${opt.port}]: error`, err)
   * })
   * wo.on('clientChange', function(num) {
   *     console.log(`Server[port:${opt.port}]: now clients: ${num}`)
   * })
   * wo.on('clientEnter', function(clientId, data) {
   *     console.log(`Server[port:${opt.port}]: client enter: ${clientId}`)
   *
   *     //deliver
   *     wo.deliver(clientId, `server deliver hi(${clientId})`)
   *
   * })
   * wo.on('clientLeave', function(clientId, data) {
   *     console.log(`Server[port:${opt.port}]: client leave: ${clientId}`)
   * })
   * wo.on('execute', function(func, input, pm) {
   *     //console.log(`Server[port:${opt.port}]: execute`, func, input)
   *     console.log(`Server[port:${opt.port}]: execute`, func)
   *
   *     try {
   *
   *         if (func === 'add') {
   *
   *             //save
   *             if (_.get(input, 'p.d.u8a', null)) {
   *                 // fs.writeFileSync(input.p.d.name, Buffer.from(input.p.d.u8a))
   *                 // console.log('writeFileSync input.p.d.name', input.p.d.name)
   *             }
   *
   *             let r = {
   *                 ab: input.p.a + input.p.b,
   *                 v: [11, 22.22, 'abc', { x: '21', y: 65.43, z: 'test中文' }],
   *                 file: {
   *                     name: 'zdata.b2',
   *                     u8a: new Uint8Array([66, 97, 115]),
   *                     //u8a: new Uint8Array(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\z500mb.7z')),
   *                 },
   *             }
   *             pm.resolve(r)
   *         }
   *         else {
   *             console.log('invalid func')
   *             pm.reject('invalid func')
   *         }
   *
   *     }
   *     catch (err) {
   *         console.log('execute error', err)
   *         pm.reject('execute error')
   *     }
   *
   * })
   * wo.on('broadcast', function(data) {
   *     console.log(`Server[port:${opt.port}]: broadcast`, data)
   * })
   * wo.on('deliver', function(data) {
   *     console.log(`Server[port:${opt.port}]: deliver`, data)
   * })
   *
   */

  function WConverhpServer() {
    var opt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var broadcastMessages = {}; //default

    if (!opt.port) {
      opt.port = 8080;
    }

    if (!opt.apiName) {
      opt.apiName = 'api';
    } //ee


    var ee = new events__default['default'].EventEmitter(); //ea

    var ea = alive(); //ea broadcastMessages

    setInterval(function () {
      //now alive
      var nowAlive = ea.get(); //console.log('nowAlive', nowAlive)
      //clientIds

      var clientIds = map_1(nowAlive, 'key'); //console.log('clientIds', clientIds)
      //pick

      var t = {};
      each(clientIds, function (clientId) {
        t[clientId] = get_1(broadcastMessages, clientId, []);
      });
      broadcastMessages = t; //console.log('broadcastMessages', broadcastMessages)
    }, 1000); //eeEmit

    function eeEmit(name) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      setTimeout(function () {
        ee.emit.apply(ee, [name].concat(args));
      }, 1);
    } //server


    var server;

    if (opt.serverHapi) {
      //use serverHapi
      server = opt.serverHapi;
    } else {
      //create server
      server = Hapi__default['default'].server({
        port: opt.port,
        //host: 'localhost',
        routes: {
          // cors: true,
          cors: {
            origin: ['*'] //Access-Control-Allow-Origin
            //credentials: true //Access-Control-Allow-Credentials

          }
        }
      });
    }

    function open() {
      eeEmit('open');
    }

    open();

    function error(msg, err) {
      eeEmit('error', {
        msg: msg,
        err: err
      });
    }
    ea.on('message', function (_ref) {
      var eventName = _ref.eventName,
          key = _ref.key,
          data = _ref.data,
          now = _ref.now;

      //console.log({ eventName, key, data, now })
      if (eventName === 'enter') {
        eeEmit('clientEnter', key, data);
      } else if (eventName === 'leave') {
        eeEmit('clientLeave', key, data);
      }

      eeEmit('clientChange', now);
    }); //dealData

    function dealData(_x) {
      return _dealData.apply(this, arguments);
    } //apiMain


    function _dealData() {
      _dealData = _asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee2(data) {
        var pm, pmm, _mode, func, input, _input, _input2, clientId, pms, msg;

        return regenerator.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                //console.log('dealData', data)
                //pm, pmm
                pm = genPm();
                pmm = genPm(); //_mode

                _mode = get_1(data, '_mode', ''); //重新處理回傳結果

                pmm.then(function (output) {
                  //add output
                  data['output'] = output; //delete input, 因input可能很大故回傳數據不包含原input

                  delete data['input']; //resolve

                  pm.resolve(data);
                }).catch(function (err) {
                  pm.reject(err);
                }); //emit

                if (_mode === 'execute') {
                  //func
                  func = get_1(data, 'func', ''); //input

                  input = get_1(data, 'input', null); //execute 執行

                  eeEmit('execute', func, input, pmm);
                } else if (_mode === 'broadcast') {
                  //input
                  _input = get_1(data, 'input', null); //broadcast 廣播

                  eeEmit('broadcast', _input); //resolve

                  pmm.resolve('ok');
                } else if (_mode === 'deliver') {
                  //input
                  _input2 = get_1(data, 'input', null); //deliver 發送

                  eeEmit('deliver', _input2); //resolve

                  pmm.resolve('ok');
                } else if (_mode === 'polling') {
                  //clientId
                  clientId = get_1(data, 'clientId', ''); //polling messages

                  pms = get_1(broadcastMessages, clientId, []);
                  pms = cloneDeep_1(pms); //clear

                  broadcastMessages[clientId] = []; //resolve

                  pmm.resolve(pms);
                } else {
                  msg = 'can not find _mode in data';
                  error(msg, data);
                  pm.reject(msg);
                  pmm.reject();
                }

                return _context2.abrupt("return", pm);

              case 6:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));
      return _dealData.apply(this, arguments);
    }

    var apiMain = {
      path: '/' + opt.apiName,
      method: 'POST',
      // config: {
      //     payload: {
      //         output: 'stream',
      //         maxBytes: 1024 * 1024 * 1024, //1g
      //     },
      // },
      options: {
        payload: {
          maxBytes: 1024 * 1024 * 1024,
          //1g
          timeout: 3 * 60 * 1000,
          //3分鐘, 注意payload timeout必須小於socket timeout
          multipart: true //hapi 19之後修改multipart預設值為false

        },
        timeout: {
          socket: 5 * 60 * 1000 //5分鐘

        }
      },
      handler: function () {
        var _handler = _asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee(req, res) {
          var bbInp, u8aInp, inp, clientId, client, out, u8aOut, sm;
          return regenerator.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  //console.log(req, res)
                  //console.log('payload', req.payload)
                  // if (Math.random() < 0.5) {
                  //     console.log('return code 500: Internal Server Error')
                  //     return res.response('Internal Server Error').code(500)
                  // }
                  //bbInp
                  bbInp = get_1(req, 'payload.bb', null); // console.log('bbInp', bbInp)
                  //check
                  //console.log('isstr(bbInp)', isstr(bbInp))

                  if (isstr(bbInp)) {
                    bbInp = Buffer.from(bbInp, 'utf8'); //收nodejs client的buffer會自動解析變成字串
                  } //u8aInp


                  u8aInp = new Uint8Array(bbInp); //console.log('u8aInp', u8aInp)
                  //u8arr2obj

                  inp = u8arr2obj(u8aInp); //console.log('inp', inp)
                  //clientId

                  clientId = get_1(inp, 'clientId'); //client

                  client = {
                    headers: req.headers,
                    info: req.info
                  }; //trigger

                  ea.trigger(clientId, client); //dealData

                  out = {};
                  _context.next = 10;
                  return dealData(inp).then(function (msg) {
                    out.success = msg;
                  }).catch(function (msg) {
                    out.error = msg;
                  });

                case 10:
                  //u8aOut
                  u8aOut = obj2u8arr(out); //stream

                  sm = new stream__default['default'].Readable();

                  sm._read = function () {};

                  sm.push(u8aOut);
                  sm.push(null); // if (out.success._mode !== 'polling') {
                  //     console.log('out', out)
                  //     console.log('u8aOut', u8aOut)
                  // }

                  return _context.abrupt("return", res.response(sm).header('Cache-Control', 'no-cache, no-store, must-revalidate').header('Content-Type', 'application/octet-stream').header('Content-Length', sm.readableLength));

                case 16:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee);
        }));

        function handler(_x2, _x3) {
          return _handler.apply(this, arguments);
        }

        return handler;
      }()
    };
    /**
     * Hapi通訊物件對全客戶端廣播函數
     *
     * @memberof WConverhpServer
     * @function broadcast
     * @param {*} data 輸入廣播函數之輸入資訊
     * @param {Function} cb 輸入進度函數
     * @example
     * let data = {...}
     * wo.broadcast(data, cb)
     */

    ee.broadcast = function (data) {
      var cbProgress = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

      //check, broadcastMessages受ea偵測頻率1s影響, 伺服器初始化後至少需1s才會有有效對象
      if (iser(broadcastMessages)) {
        //console.log('no client for broadcast')
        return;
      } //modify broadcast data


      var t = {};
      each(broadcastMessages, function (v, k) {
        //push, 數據為陣列, 加入新廣播數據
        v.push({
          mode: 'broadcast',
          data: data
        }); //save

        t[k] = v;
      });
      broadcastMessages = t; //cbProgress, 無法馬上傳需等待客戶端輪詢接收, 故進度回調只能先回傳100%

      cbProgress(100);
    };
    /**
     * Hapi通訊物件對客戶端發送訊息函數
     *
     * @memberof WConverhpServer
     * @function deliver
     * @param {String} clientId 輸入識別用使用者主鍵字串
     * @param {*} data 輸入發送函數之輸入資訊
     * @param {Function} cb 輸入進度函數
     * @example
     * let clientId = '...'
     * let data = {...}
     * wo.deliver(clientId, data, cb)
     */


    ee.deliver = function (clientId, data) {
      var cbProgress = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
      //bms, 此時有可能ea trigger為非同步, 尚未把
      var bms = get_1(broadcastMessages, clientId, []); //push

      bms.push({
        mode: 'deliver',
        data: data
      }); //modify broadcast data

      broadcastMessages[clientId] = bms; //cbProgress, 無法馬上傳需等待客戶端輪詢接收, 故進度回調只能先回傳100%

      cbProgress(100);
    };

    function startServer() {
      return _startServer.apply(this, arguments);
    }

    function _startServer() {
      _startServer = _asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee3() {
        var api;
        return regenerator.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return server.register(Inert__default['default']);

              case 2:
                //api
                api = {
                  method: 'GET',
                  path: '/{file*}',
                  handler: {
                    directory: {
                      path: './'
                    }
                  }
                }; //route

                server.route([api, apiMain]); //start

                _context3.next = 6;
                return server.start();

              case 6:
                console.log("Server running at: ".concat(server.info.uri));

              case 7:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }));
      return _startServer.apply(this, arguments);
    }

    if (opt.serverHapi) {
      opt.serverHapi.route(apiMain);
    } else {
      startServer();
    }

    return ee;
  }

  return WConverhpServer;

})));
//# sourceMappingURL=w-converhp-server.umd.js.map
