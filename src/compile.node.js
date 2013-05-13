var fs = require('fs');
var js_beautify = require('../refs/js_beautify.js');

var WQX_SRC_CODE = fs.readFileSync(__dirname + '/wqx_src.js', 'utf-8');
var OP_FUNC_TBL_CODE = require('./op_func_tbl.node.js').CODE;

var CODE = WQX_SRC_CODE.replace('.op_func_tbl = [];', '.op_func_tbl = ' + OP_FUNC_TBL_CODE + ';');
CODE = js_beautify.js_beautify(CODE);
fs.writeFileSync(__dirname + '/wqx.js', CODE, 'utf-8');