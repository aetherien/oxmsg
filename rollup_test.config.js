import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import path from 'path'

export default {
	input: 'javascript/test/index.js',
	plugins: [
		alias({
			entries: {
				"uuid": path.resolve("./node_modules/uuid/dist/index.js"),
			}
		}),
		nodeResolve({
			preferBuiltins: true,
		}),
		commonjs({
			transformMixedEsModules: true,
			ignore: [
				'memcpy' // optional dep of bytebuffer
			]
		}),
		json(), // for iconv-lite
	],
	output: [
		{
			dir: 'build/test',
			format: 'es',
			sourcemap: true,
			// dont preserve module structure or we get errors when trying to run
			preserveModules: false,
			exports: "named"
		},
	],
	treeshake: false,
}