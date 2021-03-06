var path = require('path');

var MemoryFileSystem = require('memory-fs');
var webpack = require('webpack');
var _ = require('lodash');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var plugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, './webpack-out');
var manifestPath = path.join(OUTPUT_DIR, 'manifest.json');

function webpackConfig (webpackOpts, opts) {
  return _.merge({
    output: {
      path: OUTPUT_DIR,
      filename: '[name].js'
    },
    plugins: [
      new plugin(opts.manifestOptions)
    ]
  }, webpackOpts);
}

function webpackCompile(webpackOpts, opts, cb) {
  var config;
  if (Array.isArray(webpackOpts)) {
    config = webpackOpts.map(function(x) {
      return webpackConfig(x, opts);
    });
  }
  else {
    config = webpackConfig(webpackOpts, opts);
  }

  var compiler = webpack(config);

  var fs = compiler.outputFileSystem = new MemoryFileSystem();

  compiler.run(function(err, stats){
    var manifestFile
    try {
      manifestFile = JSON.parse( fs.readFileSync(manifestPath).toString() );
    } catch (e) {
      manifestFile = null
    }


    expect(err).toBeFalsy();
    expect(stats.hasErrors()).toBe(false);

    cb(manifestFile, stats, fs);
  });
};

describe('ManifestPlugin', function() {

  it('exists', function() {
    expect(plugin).toBeDefined();
  });

  describe('basic behavior', function() {
    it('outputs a manifest of one file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js'
      }, {}, function(manifest) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js'
        });

        done();
      });
    });

    it('outputs a manifest of multiple files', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
          two: './fixtures/file-two.js'
        }
      }, {}, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'two.js': 'two.js'
        });

        done();
      });
    });

    it('multiple file output is dependency ordered', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          main: './fixtures/main.js',
          vendor: './fixtures/util.js'
        },
        plugins: [
          new plugin({
            seed: [],
            reduce: function (manifest, file) {
              return manifest.concat(file.name);
            }
          }),
          new webpack.optimize.CommonsChunkPlugin({
            name: 'common',
            filename: 'common.js'
          })
        ]
      }, {}, function(manifest) {
        expect(manifest).toEqual(['common.js', 'vendor.js', 'main.js']);

        done();
      });
    });

    it('works with hashes in the filename', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('works with source maps', function(done) {
      webpackCompile({
        context: __dirname,
        devtool: 'sourcemap',
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'one.js.map': 'one.js.map'
        });

        done();
      });
    });

    it('prefixes definitions with a base path', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          basePath: '/app/'
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': 'one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('prefixes paths with a public path', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          publicPath: '/app/'
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': '/app/one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('prefixes definitions with a base path when public path is also provided', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          basePath: '/app/',
          publicPath: '/app/'
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': '/app/one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('should keep full urls provided by basePath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          basePath: 'https://www/example.com/',
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'https://www/example.com/one.js': 'one.js'
        });

        done();
      });
    });

    it('should keep full urls provided by publicPath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          publicPath: 'http://www/example.com/',
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'http://www/example.com/one.js'
        });

        done();
      });
    });

    it('adds seed object custom attributes when provided', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: {
            test1: 'test2'
          }
        }
      }, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'test1': 'test2'
        });

        done();
      });
    });

    it('does not prefix seed attributes with basePath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          basePath: '/app/',
          publicPath: '/app/',
          seed: {
            test1: 'test2'
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': '/app/one.' + stats.hash + '.js',
          'test1': 'test2'
        });

        done();
      });
    });

    it('combines manifests of multiple compilations', function(done) {
      webpackCompile([{
        context: __dirname,
        entry: {
          one: './fixtures/file.js'
        }
      }, {
        context: __dirname,
        entry: {
          two: './fixtures/file-two.js'
        }
      }], {
        manifestOptions: {
          seed: {}
        }
      }, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'two.js': 'two.js'
        });

        done();
      });
    });

    it('still accepts cache parameter (deprecated)', function(done) {
      var cache = {};
      webpackCompile([{
        context: __dirname,
        entry: {
          one: './fixtures/file.js'
        }
      }, {
        context: __dirname,
        entry: {
          two: './fixtures/file-two.js'
        }
      }], {
        manifestOptions: {
          cache: cache
        }
      }, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'two.js': 'two.js'
        });

        done();
      });
    });

    it('outputs a manifest of no-js file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.txt',
        module: {
          loaders: [
            { test: /\.(txt)/, loader: 'file-loader?name=file.[ext]' },
          ]
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js',
          'file.txt': 'file.txt'
        });

        done();
      });
    });

    it('ensures the manifest is mapping paths to names', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.txt',
        module: {
          loaders: [
            { test: /\.(txt)/, loader: 'file-loader?name=outputfile.[ext]' },
          ]
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js',
          'file.txt': 'outputfile.txt'
        });

        done();
      });
    });

    it('make manifest available to other webpack plugins', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js'
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'main.js': 'main.js'
        });

        expect(JSON.parse(stats.compilation.assets['manifest.json'].source())).toEqual({
          'main.js': 'main.js'
        });

        done();
      });
    });
  });

  describe('with ExtractTextPlugin', function() {
    it('works when extracting css into a seperate file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          wStyles: [
            './fixtures/file.js',
            './fixtures/style.css'
          ]
        },
        output: {
          filename: '[name].js'
        },
        module: {
          loaders: [{
            test: /\.css$/,
            loader: ExtractTextPlugin.extract({
              fallback: 'style-loader',
              use: 'css-loader'
            })
          }]
        },
        plugins: [
          new plugin(),
          new ExtractTextPlugin({
            filename: '[name].css',
            allChunks: true
          })
        ]
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'wStyles.js': 'wStyles.js',
          'wStyles.css': 'wStyles.css'
        });

        done();
      });
    });
  });

  describe('nameless chunks', function() {
    it('add a literal mapping of files generated by nameless chunks.', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          nameless: './fixtures/nameless.js'
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {}, function(manifest, stats) {
        expect(Object.keys(manifest).length).toEqual(2);
        expect(manifest['nameless.js']).toEqual('nameless.'+ stats.hash +'.js');

        done();
      });
    });
  });

  describe('set location of manifest', function() {
    describe('using relative path', function() {
      it('should ', function(done) {
        webpackCompile({
          context: __dirname,
          entry: './fixtures/file.js'
        }, {
          manifestOptions: {
            fileName: 'webpack.manifest.js',
          }
        }, function(manifest, stats, fs) {
          var OUTPUT_DIR = path.join(__dirname, './webpack-out');
          var manifestPath = path.join(OUTPUT_DIR, 'webpack.manifest.js');

          var manifest = JSON.parse(fs.readFileSync(manifestPath).toString());

          expect(manifest).toEqual({
           'main.js': 'main.js'
          });

          done();
        });
      });
    });

    describe('using absolute path', function() {
      it('should ', function(done) {
        webpackCompile({
          context: __dirname,
          entry: './fixtures/file.js'
        }, {
          manifestOptions: {
            fileName: path.join(__dirname, 'webpack.manifest.js')
          }
        }, function(manifest, stats, fs) {
          var manifestPath = path.join(__dirname, 'webpack.manifest.js');

          var manifest = JSON.parse(fs.readFileSync(manifestPath).toString());

          expect(manifest).toEqual({
           'main.js': 'main.js'
          });

          done();
        });
      });
    });
  });

  describe('filter', function() {
    it('should filter out non-initial chunks', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          nameless: './fixtures/nameless.js'
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          filter: function(file) {
            return file.isInitial;
          }
        }
      }, function(manifest, stats) {
        expect(Object.keys(manifest).length).toEqual(1);
        expect(manifest['nameless.js']).toEqual('nameless.'+ stats.hash +'.js');

        done();
      });
    });
  });

  describe('map', function() {
    it('should allow modifying files defails', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          map: function(file, i) {
            file.name = i.toString();
            return file;
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '0': 'main.js'
        });

        done();
      });
    });

    it('should add subfolders', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: 'javascripts/main.js'
        }
      }, {
        manifestOptions: {
          map: function(file) {
            file.name = path.join(path.dirname(file.path), file.name);
            return file;
          }
        }
      }, function(manifest){
        expect(manifest).toEqual({
          'javascripts/main.js': 'javascripts/main.js'
        });

        done();
      });
    });
  });

  describe('sort', function() {
    it('should allow ordering of output', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
          two: './fixtures/file-two.js'
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: [],
          sort: function(file, i) {
            return 1;
          },
          reduce: function (manifest, file) {
            return manifest.concat(file.name);
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual(['two.js', 'one.js']);

        done();
      });
    });
  });

  describe('reduce', function() {
    it('should generate custom manifest', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          reduce: function (manifest, file) {
            manifest[file.name] = {
              file: file.path,
              hash: file.chunk.hash
            };
            return manifest;
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'main.js': {
            file: 'main.js',
            hash: stats.compilation.chunks[0].hash
          }
        });

        done();
      });
    });

    it('should default to `seed`', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: {
            key: 'value'
          },
          reduce: function (manifest, file) {
            expect(manifest).toEqual({
              key: 'value'
            });
            return manifest;
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          key: 'value'
        });

        done();
      });
    });

    it('should output an array', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: [],
          reduce: function (manifest, file) {
            return manifest.concat({
              name: file.name,
              file: file.path
            });
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual([
          {
            name: 'main.js',
            file: 'main.js'
          }
        ]);

        done();
      });
    });
  });
});
