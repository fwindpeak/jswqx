var wqx = new JsWqx();

var romFile;
var norFile;
var logFile;
function checkBinary(){
    if (romFile && norFile && logFile) {
        wqx.init(romFile, norFile);
        doDebug();
    }
}

function loadFile(path, callback){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener('loadend', function (){
        callback(xhr.response);
    });
    xhr.send();
}

loadFile('./refs/obj_lu.bin', function (file){
    romFile = file;
    checkBinary();
});
loadFile('./refs/nc1020.fls', function (file){
    norFile = file;
    checkBinary();
});
loadFile('./refs/wqxsimlogs.bin', function (file){
    logFile = file;
    checkBinary();
});
var start_insts = 0;
var end_insts = 0;
var peek_addr = -1;
var log_buff;
function runTests(wqx){
    var executed_insts = 0;
    var should_irq = 0;
    while (1) {
//        if (executed_insts >= start_insts && executed_insts < end_insts) {
//            var log_pc = log_buff[(executed_insts - start_insts)*8] |
//                (log_buff[(executed_insts - start_insts)*8+1] << 8);
//            var log_op = log_buff[(executed_insts - start_insts)*8+2];
//            var log_a = log_buff[(executed_insts - start_insts)*8+3];
//            var log_ps = log_buff[(executed_insts - start_insts)*8+4];
//            var log_x = log_buff[(executed_insts - start_insts)*8+5];
//            var log_y = log_buff[(executed_insts - start_insts)*8+6];
//            var log_sp = log_buff[(executed_insts - start_insts)*8+7];
//
//            var cur_op;
//            if (peek_addr === -1) {
//                cur_op = wqx.peekByte(wqx.reg_pc);
//            } else {
//                cur_op = wqx.peekByte(peek_addr);
//            }
//
//            var error = '';
//            if (log_pc != wqx.reg_pc) error += ' pc ';
//            if (log_op != cur_op) error += ' op ';
//            if (log_ps != wqx.getRegPs()) error += ' ps ';
//            if (log_a != wqx.reg_a) error += ' a ';
//            if (log_x != wqx.reg_x) error += ' x ';
//            if (log_y != wqx.reg_y) error += ' y ';
//            if (log_sp != wqx.reg_sp_) error += ' sp ';
//            if (error) {
//                var last_op = log_buff[((executed_insts - start_insts)-1)*8+2];
//                console.log((executed_insts-1) + ':' + last_op.toString(16) + ' ' + error);
//                debugger;
//                return;
//            }
//        }
        if (executed_insts >= end_insts) {
            alert('ok!');
            break;
        }
        if (executed_insts === 907768) {
//            debugger;
        }
        wqx.execute();
        executed_insts ++;

        if (should_irq && !wqx.flag_i) {
            wqx.irq();
            should_irq = 0;
        }
        if (executed_insts % 6000 === 0) {
            wqx.clock_buff[4] ++;
            wqx.p_io[0x01] |= 0x08;
            should_irq = 1;
        }
        if (executed_insts >= 3000000) {
            break;
        }
    }
//    for (var j=3000000; j--;) {
//        wqx.execute();
//    }
}
function doDebug(){
    var uint_view = new Uint32Array(logFile, 0, 2);
    start_insts = uint_view[0];
    end_insts = start_insts + uint_view[1];
    log_buff = new Uint8Array(logFile, 8);
    wqx.reset();
    var t = performance.now();
    runTests(wqx);
    alert(performance.now() - t + 'ms');
}