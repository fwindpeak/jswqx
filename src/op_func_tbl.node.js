var $CYC = function (X){
    return 'cycles = (cycles + '+ X +') | 0;';
};

var $IMPLIED = '';
var $ACC = '';
var $IMM = '' +
    'var addr = this.reg_pc;' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';
var $ZPG = '' +
    'var addr = this.peekByte(this.reg_pc);' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';
var $ZPGX = '' +
    'var addr = (this.peekByte(this.reg_pc) + this.reg_x) & 0xFF;' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';
var $ZPGY = '' +
    'var addr = (this.peekByte(this.reg_pc) + this.reg_y) & 0xFF;' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';
var $REL = '' +
    'var addr = this.peekByte(this.reg_pc);' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;' +
    'addr = (this.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;';
var $ABS = '' +
    'var addr = this.peekWord(this.reg_pc);' +
    'this.reg_pc = (this.reg_pc + 2) & 0xFFFF;';
var $ABSX = '' +
    'var addr = this.peekWord(this.reg_pc);' +
    'cycles_add = ((addr & 0xFF) + this.reg_x) & 0xFF00 ? 1 : 0;' +
    'addr = (addr + this.reg_x) & 0xFFFF;' +
    'this.reg_pc = (this.reg_pc + 2) & 0xFFFF;';
var $ABSY = '' +
    'var addr = this.peekWord(this.reg_pc);' +
    'cycles_add = ((addr & 0xFF) + this.reg_y) & 0xFF00 ? 1 : 0;' +
    'addr = (addr + this.reg_y) & 0xFFFF;' +
    'this.reg_pc = (this.reg_pc + 2) & 0xFFFF;';
var $INDABS = '' +
    'var addr = this.peekWord(this.peekWord(this.reg_pc));' +
    'this.reg_pc = (this.reg_pc + 2) & 0xFFFF;';
var $XIND = '' +
    'var addr = this.peekWord((this.peekByte(this.reg_pc) + this.reg_x) & 0xFF);' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';
var $INDY = '' +
    'var addr = this.peekWord(this.peekByte(this.reg_pc));' +
    'cycles_add = ((addr & 0xFF) + this.reg_y) & 0xFF00 ? 1 : 0;' +
    'addr = (addr + this.reg_y) & 0xFFFF;' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;';

var $LDA = 'this._setNz(this.reg_a = this.load(addr));';
var $LDX = 'this._setNz(this.reg_x = this.load(addr));';
var $LDY = 'this._setNz(this.reg_y = this.load(addr));';
var $STA = 'this.store(addr, this.reg_a);';
var $STX = 'this.store(addr, this.reg_x);';
var $STY = 'this.store(addr, this.reg_y);';

var $TAX = 'this._setNz(this.reg_x = this.reg_a);';
var $TAY = 'this._setNz(this.reg_y = this.reg_a);';
var $TXA = 'this._setNz(this.reg_a = this.reg_x);';
var $TYA = 'this._setNz(this.reg_a = this.reg_y);';

var $TSX = 'this._setNz(this.reg_x = this.reg_sp_);';
var $TXS = 'this.reg_sp_ = this.reg_x;';
var $PHA = 'this._push(this.reg_a);';
var $PHP = 'this._push(this.getRegPs());';
var $PLA = 'this._setNz(this.reg_a = this._pop());';
var $PLP = 'this.setRegPs(this._pop());';

var $AND = 'this._setNz(this.reg_a &= this.load(addr));' + $CYC('cycles_add');
var $EOR = 'this._setNz(this.reg_a ^= this.load(addr));';
var $ORA = 'this._setNz(this.reg_a |= this.load(addr));';
var $BIT = '' +
    'var tmp1 = this.load(addr);' +
    'this.flag_z = !(this.reg_a & tmp1) | 0;' +
    'this.flag_n = tmp1 >> 7;' +
    'this.flag_v = (tmp1 & 0x40) >> 6;';

var $ADC = '' +
    'var tmp1 = this.load(addr);' +
    'var tmp2 = (this.reg_a + tmp1 + this.flag_c) | 0;' +
    'this.flag_c = (tmp2 > 0xFF) | 0;' +
    'this.flag_v = ((this.reg_a ^ tmp1 ^ 0x80) & (this.reg_a ^ tmp2) & 0x80) >> 7;' +
    'this._setNz(this.reg_a = tmp2 & 0xFF);' +
    $CYC('cycles_add');
var $SBC = '' +
    'var tmp1 = this.load(addr);' +
    'var tmp2 = (this.reg_a - tmp1 + this.flag_c - 1) | 0;' +
    'this.flag_c = (tmp2 >= 0) | 0;' +
    'this.flag_v = ((this.reg_a ^ tmp1) & (this.reg_a ^ tmp2) & 0x80) >> 7;' +
    'this._setNz(this.reg_a = tmp2 & 0xFF);' +
    $CYC('cycles_add');
var $CMP = '' +
    'var tmp1 = this.reg_a - this.load(addr);' +
    'this.flag_c = (tmp1 >= 0) | 0;' +
    'this._setNz(tmp1);';
var $CPX = '' +
    'var tmp1 = this.reg_x - this.load(addr);' +
    'this.flag_c = (tmp1 >= 0) | 0;' +
    'this._setNz(tmp1);';
var $CPY = '' +
    'var tmp1 = this.reg_y - this.load(addr);' +
    'this.flag_c = (tmp1 >= 0) | 0;' +
    'this._setNz(tmp1);';

var $INC = 'this.store(addr, this._setNz((this.load(addr) + 1) & 0xFF));';
var $INX = 'this._setNz(this.reg_x = (this.reg_x + 1) & 0xFF);';
var $INY = 'this._setNz(this.reg_y = (this.reg_y + 1) & 0xFF);';
var $DEC = 'this.store(addr, this._setNz((this.load(addr) - 1) & 0xFF));';
var $DEX = 'this._setNz(this.reg_x = (this.reg_x - 1) & 0xFF);';
var $DEY = 'this._setNz(this.reg_y = (this.reg_y - 1) & 0xFF);';

var $ASL = '' +
    'var tmp1 = this.load(addr);' +
    'this.flag_c = tmp1 >> 7;' +
    'this.store(addr, this._setNz((tmp1 << 1) & 0xFF));';
var $LSR = '' +
    'var tmp1 = this.load(addr);' +
    'this.flag_c = tmp1 & 0x01;' +
    'tmp1 >>= 1;' +
    'this.flag_n = 0;' +
    'this.flag_z = !tmp1 | 0;' +
    'this.store(addr, tmp1);';
var $ROL = '' +
    'var tmp1 = this.load(addr);' +
    'this.store(addr, this._setNz(((tmp1 << 1) | this.flag_c) & 0xFF));' +
    'this.flag_c = tmp1 >> 7;';
var $ROR = '' +
    'var tmp1 = this.load(addr);' +
    'this.store(addr, this._setNz((tmp1 >> 1) | (this.flag_c << 7)));' +
    'this.flag_c = tmp1 & 0x01;';
var $ASLA = '' +
    'this.flag_c = this.reg_a >> 7;' +
    'this._setNz(this.reg_a = (this.reg_a << 1) & 0xFF);';
var $LSRA = '' +
    'this.flag_c = this.reg_a & 0x01;' +
    'this._setNz(this.reg_a >>= 1);';
var $ROLA = '' +
    'var tmp1 = this.flag_c;' +
    'this.flag_c = this.reg_a >> 7;' +
    'this._setNz(this.reg_a = ((this.reg_a << 1) | tmp1) & 0xFF);';
var $RORA = '' +
    'var tmp1 = this.flag_c;' +
    'this.flag_c = this.reg_a & 0x01;' +
    'this._setNz(this.reg_a = (this.reg_a >> 1) | (tmp1 << 7));';

var $JMP = 'this.reg_pc = addr;';
var $JSR = '' +
    'this.reg_pc = (this.reg_pc - 1) & 0xFFFF;' +
    'this._push(this.reg_pc >> 8);' +
    'this._push(this.reg_pc & 0xFF);' +
    'this.reg_pc = addr;';
var $RTS = 'this.reg_pc = ((this._pop() | (this._pop() << 8)) + 1) & 0xFFFF;';

var $BCS = 'if ( this.flag_c) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BCC = 'if (!this.flag_c) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BEQ = 'if ( this.flag_z) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BNE = 'if (!this.flag_z) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BMI = 'if ( this.flag_n) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BPL = 'if (!this.flag_n) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BVS = 'if ( this.flag_v) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';
var $BVC = 'if (!this.flag_v) { '+ $CYC('((this.reg_pc ^ addr) & 0xFF00 ? 1 : 2)') +'this.reg_pc = addr; }';

var $CLC = 'this.flag_c = 0;';
var $CLD = 'this.flag_d = 0;';
var $CLI = 'this.flag_i = 0;';
var $CLV = 'this.flag_v = 0;';
var $SEC = 'this.flag_c = 1;';
var $SED = 'this.flag_d = 1;';
var $SEI = 'this.flag_i = 1;';

var $BRK = '' +
    'this.reg_pc = (this.reg_pc + 1) & 0xFFFF;' +
    'this._push(this.reg_pc >> 8);' +
    'this._push(this.reg_pc & 0xFF);' +
    'this.flag_b = 1;' +
    'this._push(this.getRegPs());' +
    '\n//wqx set flag_i here.\n' +
    'this.flag_i = 1;' +
    'this.reg_pc = this.peekWord(this.IRQ_ADDR);';
var $NOP = '';
var $RTI = $PLP + 'this.reg_pc = (this._pop() | (this._pop() << 8));';

var INSTRUCTIONS = [];
INSTRUCTIONS[0x00] = [$BRK,          $CYC(7)];
INSTRUCTIONS[0x01] = [$XIND,$ORA,    $CYC(6)];
INSTRUCTIONS[0x02] = [                      ];
INSTRUCTIONS[0x03] = [                      ];
INSTRUCTIONS[0x04] = [                      ];
INSTRUCTIONS[0x05] = [$ZPG,$ORA,     $CYC(3)];
INSTRUCTIONS[0x06] = [$ZPG,$ASL,     $CYC(5)];
INSTRUCTIONS[0x07] = [                      ];
INSTRUCTIONS[0x08] = [$PHP,          $CYC(3)];
INSTRUCTIONS[0x09] = [$IMM,$ORA,     $CYC(2)];
INSTRUCTIONS[0x0A] = [$ASLA,         $CYC(2)];
INSTRUCTIONS[0x0B] = [                      ];
INSTRUCTIONS[0x0C] = [                      ];
INSTRUCTIONS[0x0D] = [$ABS,$ORA,     $CYC(4)];
INSTRUCTIONS[0x0E] = [$ABS,$ASL,     $CYC(6)];
INSTRUCTIONS[0x0F] = [                      ];
INSTRUCTIONS[0x10] = [$REL,$BPL,     $CYC(2)];
INSTRUCTIONS[0x11] = [$INDY,$ORA,    $CYC(5)];
INSTRUCTIONS[0x12] = [                      ];
INSTRUCTIONS[0x13] = [                      ];
INSTRUCTIONS[0x14] = [                      ];
INSTRUCTIONS[0x15] = [$ZPGX,$ORA,    $CYC(4)];
INSTRUCTIONS[0x16] = [$ZPGX,$ASL,    $CYC(6)];
INSTRUCTIONS[0x17] = [                      ];
INSTRUCTIONS[0x18] = [$CLC,          $CYC(2)];
INSTRUCTIONS[0x19] = [$ABSY,$ORA,    $CYC(4)];
INSTRUCTIONS[0x1A] = [                      ];
INSTRUCTIONS[0x1B] = [                      ];
INSTRUCTIONS[0x1C] = [                      ];
INSTRUCTIONS[0x1D] = [$ABSX,$ORA,    $CYC(4)];
INSTRUCTIONS[0x1E] = [$ABSX,$ASL,    $CYC(6)];
INSTRUCTIONS[0x1F] = [                      ];
INSTRUCTIONS[0x20] = [$ABS,$JSR,     $CYC(6)];
INSTRUCTIONS[0x21] = [$XIND,$AND,    $CYC(6)];
INSTRUCTIONS[0x22] = [                      ];
INSTRUCTIONS[0x23] = [                      ];
INSTRUCTIONS[0x24] = [$ZPG,$BIT,     $CYC(3)];
INSTRUCTIONS[0x25] = [$ZPG,$AND,     $CYC(3)];
INSTRUCTIONS[0x26] = [$ZPG,$ROL,     $CYC(5)];
INSTRUCTIONS[0x27] = [                      ];
INSTRUCTIONS[0x28] = [$PLP,          $CYC(4)];
INSTRUCTIONS[0x29] = [$IMM,$AND,     $CYC(2)];
INSTRUCTIONS[0x2A] = [$ROLA,         $CYC(2)];
INSTRUCTIONS[0x2B] = [                      ];
INSTRUCTIONS[0x2C] = [$ABS,$BIT,     $CYC(4)];
INSTRUCTIONS[0x2D] = [$ABS,$AND,     $CYC(4)];
INSTRUCTIONS[0x2E] = [$ABS,$ROL,     $CYC(6)];
INSTRUCTIONS[0x2F] = [                      ];
INSTRUCTIONS[0x30] = [$REL,$BMI,     $CYC(2)];
INSTRUCTIONS[0x31] = [$INDY,$AND,    $CYC(5)];
INSTRUCTIONS[0x32] = [                      ];
INSTRUCTIONS[0x33] = [                      ];
INSTRUCTIONS[0x34] = [                      ];
INSTRUCTIONS[0x35] = [$ZPGX,$AND,    $CYC(4)];
INSTRUCTIONS[0x36] = [$ZPGX,$ROL,    $CYC(6)];
INSTRUCTIONS[0x37] = [                      ];
INSTRUCTIONS[0x38] = [$SEC,          $CYC(2)];
INSTRUCTIONS[0x39] = [$ABSY,$AND,    $CYC(4)];
INSTRUCTIONS[0x3A] = [                      ];
INSTRUCTIONS[0x3B] = [                      ];
INSTRUCTIONS[0x3C] = [                      ];
INSTRUCTIONS[0x3D] = [$ABSX,$AND,    $CYC(4)];
INSTRUCTIONS[0x3E] = [$ABSX,$ROL,    $CYC(6)];
INSTRUCTIONS[0x3F] = [                      ];
INSTRUCTIONS[0x40] = [$RTI,          $CYC(6)];
INSTRUCTIONS[0x41] = [$XIND,$EOR,    $CYC(6)];
INSTRUCTIONS[0x42] = [                      ];
INSTRUCTIONS[0x43] = [                      ];
INSTRUCTIONS[0x44] = [                      ];
INSTRUCTIONS[0x45] = [$ZPG,$EOR,     $CYC(3)];
INSTRUCTIONS[0x46] = [$ZPG,$LSR,     $CYC(5)];
INSTRUCTIONS[0x47] = [                      ];
INSTRUCTIONS[0x48] = [$PHA,          $CYC(3)];
INSTRUCTIONS[0x49] = [$IMM,$EOR,     $CYC(2)];
INSTRUCTIONS[0x4A] = [$LSRA,         $CYC(2)];
INSTRUCTIONS[0x4B] = [                      ];
INSTRUCTIONS[0x4C] = [$ABS,$JMP,     $CYC(3)];
INSTRUCTIONS[0x4D] = [$ABS,$EOR,     $CYC(4)];
INSTRUCTIONS[0x4E] = [$ABS,$LSR,     $CYC(6)];
INSTRUCTIONS[0x4F] = [                      ];
INSTRUCTIONS[0x50] = [$REL,$BVC,     $CYC(2)];
INSTRUCTIONS[0x51] = [$INDY,$EOR,    $CYC(5)];
INSTRUCTIONS[0x52] = [                      ];
INSTRUCTIONS[0x53] = [                      ];
INSTRUCTIONS[0x54] = [                      ];
INSTRUCTIONS[0x55] = [$ZPGX,$EOR,    $CYC(4)];
INSTRUCTIONS[0x56] = [$ZPGX,$LSR,    $CYC(6)];
INSTRUCTIONS[0x57] = [                      ];
INSTRUCTIONS[0x58] = [$CLI,          $CYC(2)];
INSTRUCTIONS[0x59] = [$ABSY,$EOR,    $CYC(4)];
INSTRUCTIONS[0x5A] = [                      ];
INSTRUCTIONS[0x5B] = [                      ];
INSTRUCTIONS[0x5C] = [                      ];
INSTRUCTIONS[0x5D] = [$ABSX,$EOR,    $CYC(4)];
INSTRUCTIONS[0x5E] = [$ABSX,$LSR,    $CYC(6)];
INSTRUCTIONS[0x5F] = [                      ];
INSTRUCTIONS[0x60] = [$RTS,          $CYC(6)];
INSTRUCTIONS[0x61] = [$XIND,$ADC,    $CYC(6)];
INSTRUCTIONS[0x62] = [                      ];
INSTRUCTIONS[0x63] = [                      ];
INSTRUCTIONS[0x64] = [                      ];
INSTRUCTIONS[0x65] = [$ZPG,$ADC,     $CYC(3)];
INSTRUCTIONS[0x66] = [$ZPG,$ROR,     $CYC(5)];
INSTRUCTIONS[0x67] = [                      ];
INSTRUCTIONS[0x68] = [$PLA,          $CYC(4)];
INSTRUCTIONS[0x69] = [$IMM,$ADC,     $CYC(2)];
INSTRUCTIONS[0x6A] = [$RORA,         $CYC(2)];
INSTRUCTIONS[0x6B] = [                      ];
INSTRUCTIONS[0x6C] = [$INDABS,$JMP,  $CYC(6)];
INSTRUCTIONS[0x6D] = [$ABS,$ADC,     $CYC(4)];
INSTRUCTIONS[0x6E] = [$ABS,$ROR,     $CYC(6)];
INSTRUCTIONS[0x6F] = [                      ];
INSTRUCTIONS[0x70] = [$REL,$BVS,     $CYC(2)];
INSTRUCTIONS[0x71] = [$INDY,$ADC,    $CYC(5)];
INSTRUCTIONS[0x72] = [                      ];
INSTRUCTIONS[0x73] = [                      ];
INSTRUCTIONS[0x74] = [                      ];
INSTRUCTIONS[0x75] = [$ZPGX,$ADC,    $CYC(4)];
INSTRUCTIONS[0x76] = [$ZPGX,$ROR,    $CYC(6)];
INSTRUCTIONS[0x77] = [                      ];
INSTRUCTIONS[0x78] = [$SEI,          $CYC(2)];
INSTRUCTIONS[0x79] = [$ABSY,$ADC,    $CYC(4)];
INSTRUCTIONS[0x7A] = [                      ];
INSTRUCTIONS[0x7B] = [                      ];
INSTRUCTIONS[0x7C] = [                      ];
INSTRUCTIONS[0x7D] = [$ABSX,$ADC,    $CYC(4)];
INSTRUCTIONS[0x7E] = [$ABSX,$ROR,    $CYC(6)];
INSTRUCTIONS[0x7F] = [                      ];
INSTRUCTIONS[0x80] = [                      ];
INSTRUCTIONS[0x81] = [$XIND,$STA,    $CYC(6)];
INSTRUCTIONS[0x82] = [                      ];
INSTRUCTIONS[0x83] = [                      ];
INSTRUCTIONS[0x84] = [$ZPG,$STY,     $CYC(3)];
INSTRUCTIONS[0x85] = [$ZPG,$STA,     $CYC(3)];
INSTRUCTIONS[0x86] = [$ZPG,$STX,     $CYC(3)];
INSTRUCTIONS[0x87] = [                      ];
INSTRUCTIONS[0x88] = [$DEY,          $CYC(2)];
INSTRUCTIONS[0x89] = [                      ];
INSTRUCTIONS[0x8A] = [$TXA,          $CYC(2)];
INSTRUCTIONS[0x8B] = [                      ];
INSTRUCTIONS[0x8C] = [$ABS,$STY,     $CYC(4)];
INSTRUCTIONS[0x8D] = [$ABS,$STA,     $CYC(4)];
INSTRUCTIONS[0x8E] = [$ABS,$STX,     $CYC(4)];
INSTRUCTIONS[0x8F] = [                      ];
INSTRUCTIONS[0x90] = [$REL,$BCC,     $CYC(2)];
INSTRUCTIONS[0x91] = [$INDY,$STA,    $CYC(6)];
INSTRUCTIONS[0x92] = [                      ];
INSTRUCTIONS[0x93] = [                      ];
INSTRUCTIONS[0x94] = [$ZPGX,$STY,    $CYC(4)];
INSTRUCTIONS[0x95] = [$ZPGX,$STA,    $CYC(4)];
INSTRUCTIONS[0x96] = [$ZPGY,$STX,    $CYC(4)];
INSTRUCTIONS[0x97] = [                      ];
INSTRUCTIONS[0x98] = [$TYA,          $CYC(2)];
INSTRUCTIONS[0x99] = [$ABSY,$STA,    $CYC(5)];
INSTRUCTIONS[0x9A] = [$TXS,          $CYC(2)];
INSTRUCTIONS[0x9B] = [                      ];
INSTRUCTIONS[0x9C] = [                      ];
INSTRUCTIONS[0x9D] = [$ABSX,$STA,    $CYC(5)];
INSTRUCTIONS[0x9E] = [                      ];
INSTRUCTIONS[0x9F] = [                      ];
INSTRUCTIONS[0xA0] = [$IMM,$LDY,     $CYC(2)];
INSTRUCTIONS[0xA1] = [$XIND,$LDA,    $CYC(6)];
INSTRUCTIONS[0xA2] = [$IMM,$LDX,     $CYC(2)];
INSTRUCTIONS[0xA3] = [                      ];
INSTRUCTIONS[0xA4] = [$ZPG,$LDY,     $CYC(3)];
INSTRUCTIONS[0xA5] = [$ZPG,$LDA,     $CYC(3)];
INSTRUCTIONS[0xA6] = [$ZPG,$LDX,     $CYC(3)];
INSTRUCTIONS[0xA7] = [                      ];
INSTRUCTIONS[0xA8] = [$TAY,          $CYC(2)];
INSTRUCTIONS[0xA9] = [$IMM,$LDA,     $CYC(2)];
INSTRUCTIONS[0xAA] = [$TAX,          $CYC(2)];
INSTRUCTIONS[0xAB] = [                      ];
INSTRUCTIONS[0xAC] = [$ABS,$LDY,     $CYC(4)];
INSTRUCTIONS[0xAD] = [$ABS,$LDA,     $CYC(4)];
INSTRUCTIONS[0xAE] = [$ABS,$LDX,     $CYC(4)];
INSTRUCTIONS[0xAF] = [                      ];
INSTRUCTIONS[0xB0] = [$REL,$BCS,     $CYC(2)];
INSTRUCTIONS[0xB1] = [$INDY,$LDA,    $CYC(5)];
INSTRUCTIONS[0xB2] = [                      ];
INSTRUCTIONS[0xB3] = [                      ];
INSTRUCTIONS[0xB4] = [$ZPGX,$LDY,    $CYC(4)];
INSTRUCTIONS[0xB5] = [$ZPGX,$LDA,    $CYC(4)];
INSTRUCTIONS[0xB6] = [$ZPGY,$LDX,    $CYC(4)];
INSTRUCTIONS[0xB7] = [                      ];
INSTRUCTIONS[0xB8] = [$CLV,          $CYC(2)];
INSTRUCTIONS[0xB9] = [$ABSY,$LDA,    $CYC(4)];
INSTRUCTIONS[0xBA] = [$TSX,          $CYC(2)];
INSTRUCTIONS[0xBB] = [                      ];
INSTRUCTIONS[0xBC] = [$ABSX,$LDY,    $CYC(4)];
INSTRUCTIONS[0xBD] = [$ABSX,$LDA,    $CYC(4)];
INSTRUCTIONS[0xBE] = [$ABSY,$LDX,    $CYC(4)];
INSTRUCTIONS[0xBF] = [                      ];
INSTRUCTIONS[0xC0] = [$IMM,$CPY,     $CYC(2)];
INSTRUCTIONS[0xC1] = [$XIND,$CMP,    $CYC(6)];
INSTRUCTIONS[0xC2] = [                      ];
INSTRUCTIONS[0xC3] = [                      ];
INSTRUCTIONS[0xC4] = [$ZPG,$CPY,     $CYC(3)];
INSTRUCTIONS[0xC5] = [$ZPG,$CMP,     $CYC(3)];
INSTRUCTIONS[0xC6] = [$ZPG,$DEC,     $CYC(5)];
INSTRUCTIONS[0xC7] = [                      ];
INSTRUCTIONS[0xC8] = [$INY,          $CYC(2)];
INSTRUCTIONS[0xC9] = [$IMM,$CMP,     $CYC(2)];
INSTRUCTIONS[0xCA] = [$DEX,          $CYC(2)];
INSTRUCTIONS[0xCB] = [                      ];
INSTRUCTIONS[0xCC] = [$ABS,$CPY,     $CYC(4)];
INSTRUCTIONS[0xCD] = [$ABS,$CMP,     $CYC(4)];
INSTRUCTIONS[0xCE] = [$ABS,$DEC,     $CYC(6)];
INSTRUCTIONS[0xCF] = [                      ];
INSTRUCTIONS[0xD0] = [$REL,$BNE,     $CYC(2)];
INSTRUCTIONS[0xD1] = [$INDY,$CMP,    $CYC(5)];
INSTRUCTIONS[0xD2] = [                      ];
INSTRUCTIONS[0xD3] = [                      ];
INSTRUCTIONS[0xD4] = [                      ];
INSTRUCTIONS[0xD5] = [$ZPGX,$CMP,    $CYC(4)];
INSTRUCTIONS[0xD6] = [$ZPGX,$DEC,    $CYC(6)];
INSTRUCTIONS[0xD7] = [                      ];
INSTRUCTIONS[0xD8] = [$CLD,          $CYC(2)];
INSTRUCTIONS[0xD9] = [$ABSY,$CMP,    $CYC(4)];
INSTRUCTIONS[0xDA] = [                      ];
INSTRUCTIONS[0xDB] = [                      ];
INSTRUCTIONS[0xDC] = [                      ];
INSTRUCTIONS[0xDD] = [$ABSX,$CMP,    $CYC(4)];
INSTRUCTIONS[0xDE] = [$ABSX,$DEC,    $CYC(6)];
INSTRUCTIONS[0xDF] = [                      ];
INSTRUCTIONS[0xE0] = [$IMM,$CPX,     $CYC(2)];
INSTRUCTIONS[0xE1] = [$XIND,$SBC,    $CYC(6)];
INSTRUCTIONS[0xE2] = [                      ];
INSTRUCTIONS[0xE3] = [                      ];
INSTRUCTIONS[0xE4] = [$ZPG,$CPX,     $CYC(3)];
INSTRUCTIONS[0xE5] = [$ZPG,$SBC,     $CYC(3)];
INSTRUCTIONS[0xE6] = [$ZPG,$INC,     $CYC(5)];
INSTRUCTIONS[0xE7] = [                      ];
INSTRUCTIONS[0xE8] = [$INX,          $CYC(2)];
INSTRUCTIONS[0xE9] = [$IMM,$SBC,     $CYC(2)];
INSTRUCTIONS[0xEA] = [$NOP,          $CYC(2)];
INSTRUCTIONS[0xEB] = [                      ];
INSTRUCTIONS[0xEC] = [$ABS,$CPX,     $CYC(4)];
INSTRUCTIONS[0xED] = [$ABS,$SBC,     $CYC(4)];
INSTRUCTIONS[0xEE] = [$ABS,$INC,     $CYC(6)];
INSTRUCTIONS[0xEF] = [                      ];
INSTRUCTIONS[0xF0] = [$REL,$BEQ,     $CYC(2)];
INSTRUCTIONS[0xF1] = [$INDY,$SBC,    $CYC(5)];
INSTRUCTIONS[0xF2] = [                      ];
INSTRUCTIONS[0xF3] = [                      ];
INSTRUCTIONS[0xF4] = [                      ];
INSTRUCTIONS[0xF5] = [$ZPGX,$SBC,    $CYC(4)];
INSTRUCTIONS[0xF6] = [$ZPGX,$INC,    $CYC(6)];
INSTRUCTIONS[0xF7] = [                      ];
INSTRUCTIONS[0xF8] = [$SED,          $CYC(2)];
INSTRUCTIONS[0xF9] = [$ABSY,$SBC,    $CYC(4)];
INSTRUCTIONS[0xFA] = [                      ];
INSTRUCTIONS[0xFB] = [                      ];
INSTRUCTIONS[0xFC] = [                      ];
INSTRUCTIONS[0xFD] = [$ABSX,$SBC,    $CYC(4)];
INSTRUCTIONS[0xFE] = [$ABSX,$INC,    $CYC(6)];
INSTRUCTIONS[0xFF] = [                      ];

// http://nesdev.com/6502_cn.txt
var CYCLES_ADD_MAP = [];
// ADC:
CYCLES_ADD_MAP[0x69] = 1;
CYCLES_ADD_MAP[0x65] = 1;
CYCLES_ADD_MAP[0x75] = 1;
CYCLES_ADD_MAP[0x6D] = 1;
CYCLES_ADD_MAP[0x7D] = 1;
CYCLES_ADD_MAP[0x79] = 1;
CYCLES_ADD_MAP[0x61] = 1;
CYCLES_ADD_MAP[0x71] = 1;
// AND:
CYCLES_ADD_MAP[0x29] = 1;
CYCLES_ADD_MAP[0x25] = 1;
CYCLES_ADD_MAP[0x35] = 1;
CYCLES_ADD_MAP[0x2D] = 1;
CYCLES_ADD_MAP[0x3D] = 1;
CYCLES_ADD_MAP[0x39] = 1;
CYCLES_ADD_MAP[0x21] = 1;
CYCLES_ADD_MAP[0x31] = 1;
// CMP:
CYCLES_ADD_MAP[0xC9] = 1;
CYCLES_ADD_MAP[0xC5] = 1;
CYCLES_ADD_MAP[0xD5] = 1;
CYCLES_ADD_MAP[0xCD] = 1;
CYCLES_ADD_MAP[0xDD] = 1;
CYCLES_ADD_MAP[0xD9] = 1;
CYCLES_ADD_MAP[0xC1] = 1;
CYCLES_ADD_MAP[0xD1] = 1;
// EOR:
CYCLES_ADD_MAP[0x49] = 1;
CYCLES_ADD_MAP[0x45] = 1;
CYCLES_ADD_MAP[0x55] = 1;
CYCLES_ADD_MAP[0x4D] = 1;
CYCLES_ADD_MAP[0x5D] = 1;
CYCLES_ADD_MAP[0x59] = 1;
CYCLES_ADD_MAP[0x41] = 1;
CYCLES_ADD_MAP[0x51] = 1;
// LDA:
CYCLES_ADD_MAP[0xA9] = 1;
CYCLES_ADD_MAP[0xA5] = 1;
CYCLES_ADD_MAP[0xB5] = 1;
CYCLES_ADD_MAP[0xAD] = 1;
CYCLES_ADD_MAP[0xBD] = 1;
CYCLES_ADD_MAP[0xB9] = 1;
CYCLES_ADD_MAP[0xA1] = 1;
CYCLES_ADD_MAP[0xB1] = 1;
// LDX:
CYCLES_ADD_MAP[0xA2] = 1;
CYCLES_ADD_MAP[0xA6] = 1;
CYCLES_ADD_MAP[0xB6] = 1;
CYCLES_ADD_MAP[0xAE] = 1;
CYCLES_ADD_MAP[0xBE] = 1;
// LDY:
CYCLES_ADD_MAP[0xA0] = 1;
CYCLES_ADD_MAP[0xA4] = 1;
CYCLES_ADD_MAP[0xB4] = 1;
CYCLES_ADD_MAP[0xAC] = 1;
CYCLES_ADD_MAP[0xBC] = 1;
// ORA:
CYCLES_ADD_MAP[0x09] = 1;
CYCLES_ADD_MAP[0x05] = 1;
CYCLES_ADD_MAP[0x15] = 1;
CYCLES_ADD_MAP[0x0D] = 1;
CYCLES_ADD_MAP[0x1D] = 1;
CYCLES_ADD_MAP[0x19] = 1;
CYCLES_ADD_MAP[0x01] = 1;
CYCLES_ADD_MAP[0x11] = 1;
// SBC:
CYCLES_ADD_MAP[0xE9] = 1;
CYCLES_ADD_MAP[0xE5] = 1;
CYCLES_ADD_MAP[0xF5] = 1;
CYCLES_ADD_MAP[0xED] = 1;
CYCLES_ADD_MAP[0xFD] = 1;
CYCLES_ADD_MAP[0xF9] = 1;
CYCLES_ADD_MAP[0xE1] = 1;
CYCLES_ADD_MAP[0xF1] = 1;

exports.CODE = ('[' +
    INSTRUCTIONS.map(function (inst, opcode){
        var cycles_add = (CYCLES_ADD_MAP[opcode] && (
            inst[0] == $ABSX ||
            inst[0] == $ABSY ||
            inst[0] == $INDY
            )) ? 'var cycles_add = 0;' : '';
        if (!CYCLES_ADD_MAP[opcode] && (
            inst[0] == $ABSX ||
            inst[0] == $ABSY ||
            inst[0] == $INDY)) {
            inst[0] = inst[0].replace(/;cycles_add = [^;]+;/, ';');
        }
        if (CYCLES_ADD_MAP[opcode] && !cycles_add) {
            inst[1] = inst[1].replace($CYC('cycles_add'), '');
        }
        var body = 'var cycles = 0;'+ cycles_add + inst.join('') +'return cycles;';
        if (!inst.length) {
            body = 'return 0;';
        }
        return 'function op' +
            ('00'+ opcode.toString(16).toUpperCase()).slice(-2) +
            '(this_){ '+ body +' }'
    }).join(',') +
    ']').replace(/this\./g, 'this_.');