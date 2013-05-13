function JsWqx() {
    this.reg_pc = 0;
    this.reg_a = 0;
    this.reg_x = 0;
    this.reg_y = 0;
    this.reg_sp_ = 0;

    this.flag_c = 0;
    this.flag_z = 0;
    this.flag_i = 0;
    this.flag_d = 0;
    this.flag_b = 0;
    this.flag_v = 0;
    this.flag_n = 0;

    // wqx has 32k ram.
    this.ram = new Uint8Array(0x8000);
    this.page0 = this.pByte(this.ram, 0, 0x2000);
    this.page1 = this.pByte(this.ram, 0x2000, 0x2000);
    this.page2 = this.pByte(this.ram, 0x4000, 0x2000);
    this.page6 = this.pByte(this.ram, 0x6000, 0x2000);
    this.stack = this.pByte(this.ram, 0x100, 0x100);
    this.p_io = this.pByte(this.ram, 0, 0x40);
    this.p_40 = this.pByte(this.ram, 0x40, 0x40);
    this.bak_40 = new Uint8Array(0x40);
    this.p_lcd = null;

    this.rom = new Uint8Array(0x8000 * 0x300);
    this.nor = new Uint8Array(0x8000 * 0x20);
    this.rom_volume0 = new Array(0x100);
    this.rom_volume1 = new Array(0x100);
    this.rom_volume2 = new Array(0x100);
    for (var i = 0; i < 0x100; i++) {
        this.rom_volume0[i] = this.pByte(this.rom, 0x8000 * (i), 0x8000);
        this.rom_volume1[i] = this.pByte(this.rom, 0x8000 * (0x100 + i), 0x8000);
        this.rom_volume2[i] = this.pByte(this.rom, 0x8000 * (0x200 + i), 0x8000);
    }
    this.nor_banks = new Array(0x20);
    for (var j = 0; j < 0x20; j++) {
        this.nor_banks[j] = this.pByte(this.nor, 0x8000 * j, 0x8000);
    }
    this.bbs_pages = new Array(0x10);
    this.memmap = new Array(8);

    this.clock_buff = new Uint8Array(80);
    this.clock_flags = 0;
    this.jg_wav_buff = new Uint8Array(0x20);
    this.jg_wav_flags = 0;
    this.jg_wav_idx = 0;
    this.jg_wav_playing = 0;
    this.keypad_matrix = new Uint8Array(8);

    // flash programming.
    this.fp_step = 0;
    this.fp_type = 0;
    this.fp_bank = 0;
    this.fp_bak1 = 0;
    this.fp_bak2 = 0;
    this.fp_buff = new Uint8Array(0x100);

    this.cycles = 0;
    this._frame_timer = 0;
    this._frame_counter = 0;
    this._timer0_counter = 0;
    this._timer1_counter = 0;
    this._lcd_ctx = null;
    this._lcd_buff = new Uint8Array(1600);
}
JsWqx.prototype.RESET_ADDR = 0xFFFC;
JsWqx.prototype.NMI_ADDR = 0xFFFA;
JsWqx.prototype.IRQ_ADDR = 0xFFFE;
JsWqx.prototype.CPU_FREQ = 51200000;
JsWqx.prototype.PERFERED_FPS = 50;

JsWqx.prototype.pByte = function(buffer, byteOffset, length) {
    if (byteOffset == null) byteOffset = buffer.byteOffset | 0;
    if (!(buffer instanceof ArrayBuffer)) {
        byteOffset += buffer.byteOffset;
        buffer = buffer.buffer;
    }
    if (length == null) length = buffer.byteLength - byteOffset;
    return new Uint8Array(buffer, byteOffset, length);
};
JsWqx.prototype.memset = function(dest, value, size) {
    for (var i = 0; i < size; i++) {
        dest[i] = value;
    }
};
JsWqx.prototype.memcpy = function(dest, src, size) {
    for (var i = 0; i < size; i++) {
        dest[i] = src[i];
    }
};
JsWqx.prototype.getRegPs = function() {
    return (this.flag_c) |
        (this.flag_z << 1) |
        (this.flag_i << 2) |
        (this.flag_d << 3) |
        (this.flag_b << 4) |
        (this.flag_v << 6) |
        (this.flag_n << 7) |
        0x20;
};
JsWqx.prototype.setRegPs = function(value) {
    this.flag_c = (value & 0x01);
    this.flag_z = (value & 0x02) >> 1;
    this.flag_i = (value & 0x04) >> 2;
    this.flag_d = (value & 0x08) >> 3;
    this.flag_b = (value & 0x10) >> 4;
    this.flag_v = (value & 0x40) >> 6;
    this.flag_n = (value & 0x80) >> 7;
};
JsWqx.prototype.peekByte = function(addr) {
    return this.memmap[addr >> 13][addr & 0x1FFF];
};

JsWqx.prototype.peekWord = function(addr) {
    return this.peekByte(addr) |
        (this.peekByte((addr + 1) & 0xFFFF) << 8);
};

JsWqx.prototype.fp_type_map = new Uint8Array(0x100);
JsWqx.prototype.fp_type_map[0x90] = 1;
JsWqx.prototype.fp_type_map[0xA0] = 2;
JsWqx.prototype.fp_type_map[0x80] = 3;
JsWqx.prototype.fp_type_map[0xA8] = 4;
JsWqx.prototype.fp_type_map[0x88] = 5;
JsWqx.prototype.fp_type_map[0x78] = 6;

JsWqx.prototype._setNz = function(value) {
    this.flag_n = (value & 0x80) >> 7;
    this.flag_z = !value | 0;
    return value;
};
JsWqx.prototype._push = function(value) {
    this.stack[this.reg_sp_] = value;
    this.reg_sp_ = (this.reg_sp_ - 1) & 0xFF;
};
JsWqx.prototype._pop = function() {
    return this.stack[this.reg_sp_ = (this.reg_sp_ + 1) & 0xFF];
};
JsWqx.prototype.op_func_tbl = [
    function op00(this_) {
        var cycles = 0;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._push(this_.reg_pc >> 8);
        this_._push(this_.reg_pc & 0xFF);
        this_.flag_b = 1;
        this_._push(this_.getRegPs());
        //wqx set flag_i here.
        this_.flag_i = 1;
        this_.reg_pc = this_.peekWord(this_.IRQ_ADDR);
        cycles = (cycles + 7) | 0;
        return cycles;
    },
    function op01(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op02(this_) {
        return 0;
    },
    function op03(this_) {
        return 0;
    },
    function op04(this_) {
        return 0;
    },
    function op05(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op06(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 >> 7;
        this_.store(addr, this_._setNz((tmp1 << 1) & 0xFF));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op07(this_) {
        return 0;
    },
    function op08(this_) {
        var cycles = 0;
        this_._push(this_.getRegPs());
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op09(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op0A(this_) {
        var cycles = 0;
        this_.flag_c = this_.reg_a >> 7;
        this_._setNz(this_.reg_a = (this_.reg_a << 1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op0B(this_) {
        return 0;
    },
    function op0C(this_) {
        return 0;
    },
    function op0D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op0E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 >> 7;
        this_.store(addr, this_._setNz((tmp1 << 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op0F(this_) {
        return 0;
    },
    function op10(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (!this_.flag_n) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op11(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op12(this_) {
        return 0;
    },
    function op13(this_) {
        return 0;
    },
    function op14(this_) {
        return 0;
    },
    function op15(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op16(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 >> 7;
        this_.store(addr, this_._setNz((tmp1 << 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op17(this_) {
        return 0;
    },
    function op18(this_) {
        var cycles = 0;
        this_.flag_c = 0;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op19(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op1A(this_) {
        return 0;
    },
    function op1B(this_) {
        return 0;
    },
    function op1C(this_) {
        return 0;
    },
    function op1D(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a |= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op1E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 >> 7;
        this_.store(addr, this_._setNz((tmp1 << 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op1F(this_) {
        return 0;
    },
    function op20(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc - 1) & 0xFFFF;
        this_._push(this_.reg_pc >> 8);
        this_._push(this_.reg_pc & 0xFF);
        this_.reg_pc = addr;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op21(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op22(this_) {
        return 0;
    },
    function op23(this_) {
        return 0;
    },
    function op24(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_z = !(this_.reg_a & tmp1) | 0;
        this_.flag_n = tmp1 >> 7;
        this_.flag_v = (tmp1 & 0x40) >> 6;
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op25(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op26(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz(((tmp1 << 1) | this_.flag_c) & 0xFF));
        this_.flag_c = tmp1 >> 7;
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op27(this_) {
        return 0;
    },
    function op28(this_) {
        var cycles = 0;
        this_.setRegPs(this_._pop());
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op29(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op2A(this_) {
        var cycles = 0;
        var tmp1 = this_.flag_c;
        this_.flag_c = this_.reg_a >> 7;
        this_._setNz(this_.reg_a = ((this_.reg_a << 1) | tmp1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op2B(this_) {
        return 0;
    },
    function op2C(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_z = !(this_.reg_a & tmp1) | 0;
        this_.flag_n = tmp1 >> 7;
        this_.flag_v = (tmp1 & 0x40) >> 6;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op2D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op2E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz(((tmp1 << 1) | this_.flag_c) & 0xFF));
        this_.flag_c = tmp1 >> 7;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op2F(this_) {
        return 0;
    },
    function op30(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (this_.flag_n) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op31(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op32(this_) {
        return 0;
    },
    function op33(this_) {
        return 0;
    },
    function op34(this_) {
        return 0;
    },
    function op35(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op36(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz(((tmp1 << 1) | this_.flag_c) & 0xFF));
        this_.flag_c = tmp1 >> 7;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op37(this_) {
        return 0;
    },
    function op38(this_) {
        var cycles = 0;
        this_.flag_c = 1;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op39(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op3A(this_) {
        return 0;
    },
    function op3B(this_) {
        return 0;
    },
    function op3C(this_) {
        return 0;
    },
    function op3D(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a &= this_.load(addr));
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op3E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz(((tmp1 << 1) | this_.flag_c) & 0xFF));
        this_.flag_c = tmp1 >> 7;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op3F(this_) {
        return 0;
    },
    function op40(this_) {
        var cycles = 0;
        this_.setRegPs(this_._pop());
        this_.reg_pc = (this_._pop() | (this_._pop() << 8));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op41(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op42(this_) {
        return 0;
    },
    function op43(this_) {
        return 0;
    },
    function op44(this_) {
        return 0;
    },
    function op45(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op46(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 & 0x01;
        tmp1 >>= 1;
        this_.flag_n = 0;
        this_.flag_z = !tmp1 | 0;
        this_.store(addr, tmp1);
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op47(this_) {
        return 0;
    },
    function op48(this_) {
        var cycles = 0;
        this_._push(this_.reg_a);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op49(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op4A(this_) {
        var cycles = 0;
        this_.flag_c = this_.reg_a & 0x01;
        this_._setNz(this_.reg_a >>= 1);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op4B(this_) {
        return 0;
    },
    function op4C(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.reg_pc = addr;
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op4D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op4E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 & 0x01;
        tmp1 >>= 1;
        this_.flag_n = 0;
        this_.flag_z = !tmp1 | 0;
        this_.store(addr, tmp1);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op4F(this_) {
        return 0;
    },
    function op50(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (!this_.flag_v) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op51(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op52(this_) {
        return 0;
    },
    function op53(this_) {
        return 0;
    },
    function op54(this_) {
        return 0;
    },
    function op55(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op56(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 & 0x01;
        tmp1 >>= 1;
        this_.flag_n = 0;
        this_.flag_z = !tmp1 | 0;
        this_.store(addr, tmp1);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op57(this_) {
        return 0;
    },
    function op58(this_) {
        var cycles = 0;
        this_.flag_i = 0;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op59(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op5A(this_) {
        return 0;
    },
    function op5B(this_) {
        return 0;
    },
    function op5C(this_) {
        return 0;
    },
    function op5D(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a ^= this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op5E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.flag_c = tmp1 & 0x01;
        tmp1 >>= 1;
        this_.flag_n = 0;
        this_.flag_z = !tmp1 | 0;
        this_.store(addr, tmp1);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op5F(this_) {
        return 0;
    },
    function op60(this_) {
        var cycles = 0;
        this_.reg_pc = ((this_._pop() | (this_._pop() << 8)) + 1) & 0xFFFF;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op61(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op62(this_) {
        return 0;
    },
    function op63(this_) {
        return 0;
    },
    function op64(this_) {
        return 0;
    },
    function op65(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op66(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz((tmp1 >> 1) | (this_.flag_c << 7)));
        this_.flag_c = tmp1 & 0x01;
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op67(this_) {
        return 0;
    },
    function op68(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_a = this_._pop());
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op69(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op6A(this_) {
        var cycles = 0;
        var tmp1 = this_.flag_c;
        this_.flag_c = this_.reg_a & 0x01;
        this_._setNz(this_.reg_a = (this_.reg_a >> 1) | (tmp1 << 7));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op6B(this_) {
        return 0;
    },
    function op6C(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.peekWord(this_.reg_pc));
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.reg_pc = addr;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op6D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op6E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz((tmp1 >> 1) | (this_.flag_c << 7)));
        this_.flag_c = tmp1 & 0x01;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op6F(this_) {
        return 0;
    },
    function op70(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (this_.flag_v) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op71(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op72(this_) {
        return 0;
    },
    function op73(this_) {
        return 0;
    },
    function op74(this_) {
        return 0;
    },
    function op75(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op76(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz((tmp1 >> 1) | (this_.flag_c << 7)));
        this_.flag_c = tmp1 & 0x01;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op77(this_) {
        return 0;
    },
    function op78(this_) {
        var cycles = 0;
        this_.flag_i = 1;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op79(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op7A(this_) {
        return 0;
    },
    function op7B(this_) {
        return 0;
    },
    function op7C(this_) {
        return 0;
    },
    function op7D(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a + tmp1 + this_.flag_c) | 0;
        this_.flag_c = (tmp2 > 0xFF) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1 ^ 0x80) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op7E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        this_.store(addr, this_._setNz((tmp1 >> 1) | (this_.flag_c << 7)));
        this_.flag_c = tmp1 & 0x01;
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op7F(this_) {
        return 0;
    },
    function op80(this_) {
        return 0;
    },
    function op81(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op82(this_) {
        return 0;
    },
    function op83(this_) {
        return 0;
    },
    function op84(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_y);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op85(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op86(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_x);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function op87(this_) {
        return 0;
    },
    function op88(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_y = (this_.reg_y - 1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op89(this_) {
        return 0;
    },
    function op8A(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_a = this_.reg_x);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op8B(this_) {
        return 0;
    },
    function op8C(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_.reg_y);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op8D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op8E(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_.reg_x);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op8F(this_) {
        return 0;
    },
    function op90(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (!this_.flag_c) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op91(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function op92(this_) {
        return 0;
    },
    function op93(this_) {
        return 0;
    },
    function op94(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_y);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op95(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op96(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_y) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_.reg_x);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function op97(this_) {
        return 0;
    },
    function op98(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_a = this_.reg_y);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op99(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op9A(this_) {
        var cycles = 0;
        this_.reg_sp_ = this_.reg_x;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function op9B(this_) {
        return 0;
    },
    function op9C(this_) {
        return 0;
    },
    function op9D(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_.reg_a);
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function op9E(this_) {
        return 0;
    },
    function op9F(this_) {
        return 0;
    },
    function opA0(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_y = this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opA1(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opA2(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_x = this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opA3(this_) {
        return 0;
    },
    function opA4(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_y = this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opA5(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opA6(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_x = this_.load(addr));
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opA7(this_) {
        return 0;
    },
    function opA8(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_y = this_.reg_a);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opA9(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opAA(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_x = this_.reg_a);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opAB(this_) {
        return 0;
    },
    function opAC(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_y = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opAD(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opAE(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_x = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opAF(this_) {
        return 0;
    },
    function opB0(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (this_.flag_c) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opB1(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function opB2(this_) {
        return 0;
    },
    function opB3(this_) {
        return 0;
    },
    function opB4(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_y = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opB5(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opB6(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_y) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_._setNz(this_.reg_x = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opB7(this_) {
        return 0;
    },
    function opB8(this_) {
        var cycles = 0;
        this_.flag_v = 0;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opB9(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opBA(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_x = this_.reg_sp_);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opBB(this_) {
        return 0;
    },
    function opBC(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_y = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opBD(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_a = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opBE(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_._setNz(this_.reg_x = this_.load(addr));
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opBF(this_) {
        return 0;
    },
    function opC0(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_y - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opC1(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opC2(this_) {
        return 0;
    },
    function opC3(this_) {
        return 0;
    },
    function opC4(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_y - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opC5(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opC6(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) - 1) & 0xFF));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function opC7(this_) {
        return 0;
    },
    function opC8(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_y = (this_.reg_y + 1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opC9(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opCA(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_x = (this_.reg_x - 1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opCB(this_) {
        return 0;
    },
    function opCC(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.reg_y - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opCD(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opCE(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) - 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opCF(this_) {
        return 0;
    },
    function opD0(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (!this_.flag_z) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opD1(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function opD2(this_) {
        return 0;
    },
    function opD3(this_) {
        return 0;
    },
    function opD4(this_) {
        return 0;
    },
    function opD5(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opD6(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) - 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opD7(this_) {
        return 0;
    },
    function opD8(this_) {
        var cycles = 0;
        this_.flag_d = 0;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opD9(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opDA(this_) {
        return 0;
    },
    function opDB(this_) {
        return 0;
    },
    function opDC(this_) {
        return 0;
    },
    function opDD(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.reg_a - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opDE(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) - 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opDF(this_) {
        return 0;
    },
    function opE0(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_x - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opE1(this_) {
        var cycles = 0;
        var addr = this_.peekWord((this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opE2(this_) {
        return 0;
    },
    function opE3(this_) {
        return 0;
    },
    function opE4(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.reg_x - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opE5(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 3) | 0;
        return cycles;
    },
    function opE6(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) + 1) & 0xFF));
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function opE7(this_) {
        return 0;
    },
    function opE8(this_) {
        var cycles = 0;
        this_._setNz(this_.reg_x = (this_.reg_x + 1) & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opE9(this_) {
        var cycles = 0;
        var addr = this_.reg_pc;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opEA(this_) {
        var cycles = 0;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opEB(this_) {
        return 0;
    },
    function opEC(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.reg_x - this_.load(addr);
        this_.flag_c = (tmp1 >= 0) | 0;
        this_._setNz(tmp1);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opED(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opEE(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) + 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opEF(this_) {
        return 0;
    },
    function opF0(this_) {
        var cycles = 0;
        var addr = this_.peekByte(this_.reg_pc);
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        addr = (this_.reg_pc + addr - ((addr & 0x80) << 1)) & 0xFFFF;
        if (this_.flag_z) {
            cycles = (cycles + ((this_.reg_pc ^ addr) & 0xFF00 ? 1 : 2)) | 0;
            this_.reg_pc = addr;
        }
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opF1(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.peekByte(this_.reg_pc));
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 5) | 0;
        return cycles;
    },
    function opF2(this_) {
        return 0;
    },
    function opF3(this_) {
        return 0;
    },
    function opF4(this_) {
        return 0;
    },
    function opF5(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opF6(this_) {
        var cycles = 0;
        var addr = (this_.peekByte(this_.reg_pc) + this_.reg_x) & 0xFF;
        this_.reg_pc = (this_.reg_pc + 1) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) + 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opF7(this_) {
        return 0;
    },
    function opF8(this_) {
        var cycles = 0;
        this_.flag_d = 1;
        cycles = (cycles + 2) | 0;
        return cycles;
    },
    function opF9(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_y) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_y) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opFA(this_) {
        return 0;
    },
    function opFB(this_) {
        return 0;
    },
    function opFC(this_) {
        return 0;
    },
    function opFD(this_) {
        var cycles = 0;
        var cycles_add = 0;
        var addr = this_.peekWord(this_.reg_pc);
        cycles_add = ((addr & 0xFF) + this_.reg_x) & 0xFF00 ? 1 : 0;
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        var tmp1 = this_.load(addr);
        var tmp2 = (this_.reg_a - tmp1 + this_.flag_c - 1) | 0;
        this_.flag_c = (tmp2 >= 0) | 0;
        this_.flag_v = ((this_.reg_a ^ tmp1) & (this_.reg_a ^ tmp2) & 0x80) >> 7;
        this_._setNz(this_.reg_a = tmp2 & 0xFF);
        cycles = (cycles + cycles_add) | 0;
        cycles = (cycles + 4) | 0;
        return cycles;
    },
    function opFE(this_) {
        var cycles = 0;
        var addr = this_.peekWord(this_.reg_pc);
        addr = (addr + this_.reg_x) & 0xFFFF;
        this_.reg_pc = (this_.reg_pc + 2) & 0xFFFF;
        this_.store(addr, this_._setNz((this_.load(addr) + 1) & 0xFF));
        cycles = (cycles + 6) | 0;
        return cycles;
    },
    function opFF(this_) {
        return 0;
    }
];

JsWqx.prototype._switchBank = function(bank) {
    this.memmap[2] = this.pByte(bank, 0, 0x2000);
    this.memmap[3] = this.pByte(bank, 0x2000, 0x2000);
    this.memmap[4] = this.pByte(bank, 0x4000, 0x2000);
    this.memmap[5] = this.pByte(bank, 0x6000, 0x2000);
};

JsWqx.prototype._get40Pointer = function(idx) {
    if (idx < 4) {
        return this.p_io;
    } else {
        return this.pByte(this.page0, (idx + 4) << 6, 0x40);
    }
};

JsWqx.prototype._fillBBsPages = function(volume) {
    for (var i = 0; i < 4; i++) {
        this.bbs_pages[i * 4] = this.pByte(volume[i], 0, 0x2000);
        this.bbs_pages[i * 4 + 1] = this.pByte(volume[i], 0x2000, 0x2000);
        this.bbs_pages[i * 4 + 2] = this.pByte(volume[i], 0x4000, 0x2000);
        this.bbs_pages[i * 4 + 3] = this.pByte(volume[i], 0x6000, 0x2000);
    }
    this.bbs_pages[1] = this.page6;
};

JsWqx.prototype._generateAndPlayJGWav = function() {

};

(function() {
    function readXX(this_, addr) {
        return this_.p_io[addr];
    }

    // clock

    function read3B(this_, addr) {
        if (!(this_.p_io[0x3D] & 0x03)) {
            return this_.clock_buff[0x3B] & 0xFE;
        }
        return this_.p_io[addr];
    }

    function read3F(this_, addr) {
        var idx = this_.p_io[0x3E];
        if (idx < 80) {
            return this_.clock_buff[idx];
        }
        return this_.p_io[addr];
    }

    function writeXX(this_, addr, value) {
        this_.p_io[addr] = value;
    }

    // switch bank.

    function write00(this_, addr, value) {
        var old_value = this_.p_io[addr];
        this_.p_io[addr] = value;
        if (value !== old_value) {
            if (value < 0x20) {
                this_._switchBank(this_.nor_banks[value]);
            } else if (value >= 0x80) {
                var volume_idx = this_.p_io[0x0D];
                if (volume_idx & 0x01) {
                    this_._switchBank(this_.rom_volume1[value]);
                } else if (volume_idx & 0x02) {
                    this_._switchBank(this_.rom_volume2[value]);
                } else {
                    this_._switchBank(this_.rom_volume0[value]);
                }
            }
        }
    }

    function write06(this_, addr, value) {
        this_.p_io[addr] = value;
        if (!this_.p_lcd) {
            this_.p_lcd = this_.pByte(this_.ram, ((this_.p_io[0x0C] & 0x03) << 12) | (value << 4), 1600);
        }
        this_.p_io[0x09] &= 0xFE;
    }

    function write08(this_, addr, value) {
        this_.p_io[addr] = value;
        this_.p_io[0x0B] &= 0xFE;
    }

    // keypad matrix.

    function write09(this_, addr, value) {
        this_.p_io[addr] = value;
        switch (value) {
            case 0x01:
                this_.p_io[0x08] = this_.keypad_matrix[0];
                break;
            case 0x02:
                this_.p_io[0x08] = this_.keypad_matrix[1];
                break;
            case 0x04:
                this_.p_io[0x08] = this_.keypad_matrix[2];
                break;
            case 0x08:
                this_.p_io[0x08] = this_.keypad_matrix[3];
                break;
            case 0x10:
                this_.p_io[0x08] = this_.keypad_matrix[4];
                break;
            case 0x20:
                this_.p_io[0x08] = this_.keypad_matrix[5];
                break;
            case 0x40:
                this_.p_io[0x08] = this_.keypad_matrix[6];
                break;
            case 0x80:
                this_.p_io[0x08] = this_.keypad_matrix[7];
                break;
            case 0:
                this_.p_io[0x0B] |= 1;
                if (this_.keypad_matrix[7] == 0xFE) {
                    this_.p_io[0x0B] &= 0xFE;
                }
                break;
            case 0x7F:
                if (this_.p_io[0x15] == 0x7F) {
                    this_.p_io[0x08] = (
                        this_.keypad_matrix[0] |
                        this_.keypad_matrix[1] |
                        this_.keypad_matrix[2] |
                        this_.keypad_matrix[3] |
                        this_.keypad_matrix[4] |
                        this_.keypad_matrix[5] |
                        this_.keypad_matrix[6] |
                        this_.keypad_matrix[7]);
                }
                break;
        }
    }

    // roabbs

    function write0A(this_, addr, value) {
        var old_value = this_.p_io[addr];
        this_.p_io[addr] = value;
        if (value !== old_value) {
            this_.memmap[6] = this_.bbs_pages[value & 0x0F];
        }
    }

    // switch volume

    function write0D(this_, addr, value) {
        var old_value = this_.p_io[addr];
        this_.p_io[addr] = value;
        if (value !== old_value) {
            var bank_idx = this_.p_io[0x00];
            var volume = (value & 0x03 === 1 ? this_.rom_volume1 :
                value & 0x03 === 3 ? this_.rom_volume2 : this_.rom_volume0);
            this_._fillBBsPages(volume);
            this_.memmap[7] = this_.pByte(volume[0], 0x2000, 0x2000);
            var roa_bbs = this_.p_io[0x0A];
            this_.memmap[1] = (roa_bbs & 0x04 ? this_.page2 : this_.page1);
            this_.memmap[6] = this_.bbs_pages[roa_bbs & 0x0F];
            this_._switchBank(volume[bank_idx]);
        }
    }

    // zp40 switch

    function write0F(this_, addr, value) {
        var old_value = this_.p_io[addr];
        this_.p_io[addr] = value;
        old_value &= 0x07;
        value &= 0x07;
        if (value !== old_value) {
            var ptr_new = this_._get40Pointer(value);
            if (old_value) {
                this_.memcpy(this_._get40Pointer(old_value), this_.p_40, 0x40);
                this_.memcpy(this_.p_40, value ? ptr_new : this_.bak_40, 0x40);
            } else {
                this_.memcpy(this_.bak_40, this_.p_40, 0x40);
                this_.memcpy(this_.p_40, ptr_new, 0x40);
            }
        }
    }

    function write20(this_, addr, value) {
        this_.p_io[addr] = value;
        if (value === 0x80 || value === 0x40) {
            this_.memset(this_.jg_wav_buff, 0, 0x20);
            this_.p_io[0x20] = 0;
            this_.jg_wav_flags = 1;
            this_.jg_wav_idx = 0;
        }
    }

    function write23(this_, addr, value) {
        this_.p_io[addr] = value;
        if (value === 0xC2) {
            this_.jg_wav_buff[this_.jg_wav_idx] = this_.p_io[0x22];
        } else if (value === 0xC4) {
            if (this_.jg_wav_idx < 0x20) {
                this_.jg_wav_buff[this_.jg_wav_idx] = this_.p_io[0x22];
                this_.jg_wav_idx++;
            }
        } else if (value === 0x80) {
            this_.p_io[0x20] = 0x80;
            this_.p_io[0x20] = 0x80;
            this_.jg_wav_flags = 0;
            if (this_.jg_wav_idx) {
                if (!this_.jg_wav_playing) {
                    this_._generateAndPlayJGWav();
                    this_.jg_wav_idx = 0;
                }
            }
        }
        if (this_.jg_wav_playing) {
            // todo.
        }
    }

    // clock.

    function write3F(this_, addr, value) {
        this_.p_io[addr] = value;
        var idx = this_.p_io[0x3E];
        if (idx >= 0x07) {
            if (idx === 0x0B) {
                this_.p_io[0x3D] = 0xF8;
                this_.clock_flags |= value & 0x07;
                this_.clock_buff[0x0B] = value ^ ((this_.clock_buff[0x0B] ^ value) & 0x7F);
            } else if (idx === 0x0A) {
                this_.clock_flags |= value & 0x07;
                this_.clock_buff[0x0A] = value;
            } else {
                this_.clock_buff[idx % 80] = value;
            }
        } else {
            if (!(this_.clock_buff[0x0B] & 0x80) && idx < 80) {
                this_.clock_buff[idx] = value;
            }
        }
    }

    //region JsWqx.prototype.io_read
    JsWqx.prototype.io_read = [
        readXX, // 0x00
        readXX, // 0x01
        readXX, // 0x02
        readXX, // 0x03
        readXX, // 0x04
        readXX, // 0x05
        readXX, // 0x06
        readXX, // 0x07
        readXX, // 0x08
        readXX, // 0x09
        readXX, // 0x0A
        readXX, // 0x0B
        readXX, // 0x0C
        readXX, // 0x0D
        readXX, // 0x0E
        readXX, // 0x0F
        readXX, // 0x10
        readXX, // 0x11
        readXX, // 0x12
        readXX, // 0x13
        readXX, // 0x14
        readXX, // 0x15
        readXX, // 0x16
        readXX, // 0x17
        readXX, // 0x18
        readXX, // 0x19
        readXX, // 0x1A
        readXX, // 0x1B
        readXX, // 0x1C
        readXX, // 0x1D
        readXX, // 0x1E
        readXX, // 0x1F
        readXX, // 0x20
        readXX, // 0x21
        readXX, // 0x22
        readXX, // 0x23
        readXX, // 0x24
        readXX, // 0x25
        readXX, // 0x26
        readXX, // 0x27
        readXX, // 0x28
        readXX, // 0x29
        readXX, // 0x2A
        readXX, // 0x2B
        readXX, // 0x2C
        readXX, // 0x2D
        readXX, // 0x2E
        readXX, // 0x2F
        readXX, // 0x30
        readXX, // 0x31
        readXX, // 0x32
        readXX, // 0x33
        readXX, // 0x34
        readXX, // 0x35
        readXX, // 0x36
        readXX, // 0x37
        readXX, // 0x38
        readXX, // 0x39
        readXX, // 0x3A
        read3B, // 0x3B
        readXX, // 0x3C
        readXX, // 0x3D
        readXX, // 0x3E
        read3F // 0x3F
    ];
    //endregion io_read

    //region JsWqx.prototype.io_write
    JsWqx.prototype.io_write = [
        write00, // 0x00
        writeXX, // 0x01
        writeXX, // 0x02
        writeXX, // 0x03
        writeXX, // 0x04
        writeXX, // 0x05
        write06, // 0x06
        writeXX, // 0x07
        write08, // 0x08
        write09, // 0x09
        write0A, // 0x0A
        writeXX, // 0x0B
        writeXX, // 0x0C
        write0D, // 0x0D
        writeXX, // 0x0E
        write0F, // 0x0F
        writeXX, // 0x10
        writeXX, // 0x11
        writeXX, // 0x12
        writeXX, // 0x13
        writeXX, // 0x14
        writeXX, // 0x15
        writeXX, // 0x16
        writeXX, // 0x17
        writeXX, // 0x18
        writeXX, // 0x19
        writeXX, // 0x1A
        writeXX, // 0x1B
        writeXX, // 0x1C
        writeXX, // 0x1D
        writeXX, // 0x1E
        writeXX, // 0x1F
        write20, // 0x20
        writeXX, // 0x21
        writeXX, // 0x22
        write23, // 0x23
        writeXX, // 0x24
        writeXX, // 0x25
        writeXX, // 0x26
        writeXX, // 0x27
        writeXX, // 0x28
        writeXX, // 0x29
        writeXX, // 0x2A
        writeXX, // 0x2B
        writeXX, // 0x2C
        writeXX, // 0x2D
        writeXX, // 0x2E
        writeXX, // 0x2F
        writeXX, // 0x30
        writeXX, // 0x31
        writeXX, // 0x32
        writeXX, // 0x33
        writeXX, // 0x34
        writeXX, // 0x35
        writeXX, // 0x36
        writeXX, // 0x37
        writeXX, // 0x38
        writeXX, // 0x39
        writeXX, // 0x3A
        writeXX, // 0x3B
        writeXX, // 0x3C
        writeXX, // 0x3D
        writeXX, // 0x3E
        write3F // 0x3F
    ];
    //endregion io_write
})();

JsWqx.prototype.load = function(addr) {
    if (addr < 0x40) {
        return this.io_read[addr](this, addr);
    }
    if (((this.fp_step === 4 && this.fp_type === 2) ||
        (this.fp_step === 6 && this.fp_type === 3)) &&
        (addr >= 0x4000 && addr < 0xC000)) {
        this.fp_step = 0;
        return 0x88;
    }
    return this.peekByte(addr);
};

JsWqx.prototype.store = function(addr, value) {
    if (addr < 0x40) {
        this.io_write[addr](this, addr, value);
        return;
    }

    if (addr < 0x4000) {
        this.memmap[addr >> 13][addr & 0x1FFF] = value;
        return;
    }

    var page = this.memmap[addr >> 13];
    if (page === this.page2 || page === this.page6) {
        page[addr & 0x1FFF] = value;
        return;
    }

    if (addr >= 0xE000) {
        return;
    }

    // write to nor_flash address space.
    // there must select a nor_bank.

    var bank_idx = this.p_io[0x00];
    if (bank_idx >= 0x20) {
        return;
    }

    var fp_bank = this.nor_banks[bank_idx];

    if (this.fp_step === 0) {
        if (addr === 0x5555 && value === 0xAA) {
            this.fp_step = 1;
        }
        return;
    }
    if (this.fp_step === 1) {
        if (addr === 0xAAAA && value === 0x55) {
            this.fp_step = 2;
            return;
        }
    } else if (this.fp_step === 2) {
        if (addr === 0x5555) {
            this.fp_type = this.fp_type_map[value];
            if (this.fp_type) {
                if (this.fp_type === 1) {
                    this.fp_bank = fp_bank;
                    this.fp_bak1 = fp_bank[0x4000];
                    this.fp_bak1 = fp_bank[0x4001];
                }
                this.fp_step = 3;
                return;
            }
        }
    } else if (this.fp_step === 3) {
        if (this.fp_type === 1) {
            if (value === 0xF0) {
                this.fp_bank[0x4000] = this.fp_bak1;
                this.fp_bank[0x4001] = this.fp_bak2;
                this.fp_step = 0;
                return;
            }
        } else if (this.fp_type === 2) {
            fp_bank[addr - 0x4000] &= value;
            this.fp_step = 4;
            return;
        } else if (this.fp_type === 4) {
            this.fp_buff[addr & 0xFF] &= value;
            this.fp_step = 4;
            return;
        } else if (this.fp_type === 3 || this.fp_type === 5) {
            if (addr === 0x5555 && value === 0xAA) {
                this.fp_step = 4;
                return;
            }
        }
    } else if (this.fp_step === 4) {
        if (this.fp_type === 3 || this.fp_type === 5) {
            if (addr === 0xAAAA && value === 0x55) {
                this.fp_step = 5;
                return;
            }
        }
    } else if (this.fp_step === 5) {
        if (addr === 0x5555 && value === 0x10) {
            this.nor_banks.forEach(function(nor_bank) {
                this.memset(nor_bank, 0xFF, 0x8000);
            }, this);
            if (this.fp_type === 5) {
                this.memset(this.fp_buff, 0xFF, 0x100);
            }
            this.fp_step = 6;
            return;
        }
        if (this.fp_type === 3) {
            if (value === 0x30) {
                this.memset(this.pByte(fp_bank,
                    addr - (addr % 0x800) - 0x4000, 0x800), 0xFF, 0x800);
                this.fp_step = 6;
                return;
            }
        } else if (this.fp_type === 5) {
            if (value === 0x48) {
                this.memset(this.fp_buff, 0xFF, 0x100);
                this.fp_step = 6;
                return;
            }
        }
    }
    if (addr === 0x8000 && value === 0xF0) {
        this.fp_step = 0;
        return;
    }
    console.log('error occurs when operate in flash!');
};

JsWqx.prototype.adjustTime = function() {
    if (++this.clock_buff[0] >= 60) {
        this.clock_buff[0] = 0;
        if (++this.clock_buff[1] >= 60) {
            this.clock_buff[1] = 0;
            if (++this.clock_buff[2] >= 24) {
                this.clock_buff[2] &= 0;
                ++this.clock_buff[3];
            }
        }
    }
};
JsWqx.prototype.encounterIRQClock = function() {
    if ((this.clock_buff[10] & 0x02) && (this.clock_flags & 0x02)) {
        return (((this.clock_buff[7] & 0x80) && !((this.clock_buff[7] ^ this.clock_buff[2])) & 0x1F) ||
            ((this.clock_buff[6] & 0x80) && !((this.clock_buff[6] ^ this.clock_buff[1])) & 0x3F) ||
            ((this.clock_buff[5] & 0x80) && !((this.clock_buff[5] ^ this.clock_buff[0])) & 0x3F));
    }
    return true;
};

JsWqx.prototype.setKey = function(key, value) {
    var row = key & 0x07;
    var col = key >> 3;
    if (value) {
        this.keypad_matrix[row] |= 1 << col;
    } else {
        this.keypad_matrix[row] &= ~(1 << col);
    }
};

JsWqx.prototype.irq = function() {
    if (!this.flag_i) {
        this._push(this.reg_pc >> 8);
        this._push(this.reg_pc & 0xFF);
        this.flag_b = 0;
        this._push(this.getRegPs());
        this.reg_pc = this.peekWord(this.IRQ_ADDR);
        this.flag_i = 1;
    }
};

JsWqx.prototype._loadBinary = function(dest, src) {
    var byteOffset = 0;
    while (byteOffset < src.byteLength) {
        var dest1 = this.pByte(dest, byteOffset + 0x4000, 0x4000);
        var dest2 = this.pByte(dest, byteOffset, 0x4000);
        var src1 = this.pByte(src, byteOffset, 0x4000);
        var src2 = this.pByte(src, byteOffset + 0x4000, 0x4000);
        this.memcpy(dest1, src1, 0x4000);
        this.memcpy(dest2, src2, 0x4000);
        byteOffset += 0x8000;
    }
};
JsWqx.prototype.init = function(rom, nor, ctx) {
    this._loadBinary(this.rom, rom);
    this._loadBinary(this.nor, nor);
    if (ctx) {
        this._lcd_ctx = ctx;
        this._lcd_ctx.setTransform(2, 0, 0, 2, 0, 0);
        this._lcd_ctx.fillStyle = '#000000';
    }
};

JsWqx.prototype.reset = function() {
    this.memset(this.ram, 0, 0x8000);
    this.memmap[0] = this.page0;
    this.memmap[1] = this.page1;
    this.memmap[2] = this.page2;
    this._fillBBsPages(this.rom_volume0);
    this.memmap[6] = this.bbs_pages[0];
    this.memmap[7] = this.pByte(this.rom_volume0[0], 0x2000, 0x2000);
    this._switchBank(this.rom_volume0[0]);
    this.reg_a = 0;
    this.reg_x = 0;
    this.reg_y = 0;
    this.reg_sp_ = 0xFF;
    this.setRegPs(0x24);
    this.reg_pc = this.peekWord(this.RESET_ADDR);
    this.cycles = 0;
    if (this._lcd_ctx) {
        this._lcd_ctx.clearRect(0, 0, 188, 80);
    }
    this.memset(this._lcd_buff, 0, 1600);
    this.memset(this.clock_buff, 0, 80);
    this.clock_flags = 0;
    this.memset(this.jg_wav_buff, 0, 0x20);
    this.jg_wav_flags = 0;
    this.jg_wav_idx = 0;
    this.jg_wav_playing = 0;
    this.fp_step = 0;
    this._frame_counter = 0;
    this._timer1_counter = 0;
};
JsWqx.prototype.execute = function() {
    var opcode = this.peekByte(this.reg_pc);
    this.reg_pc = (this.reg_pc + 1) & 0xFFFF;
    return this.op_func_tbl[opcode](this);
};

JsWqx.prototype.putPixel = function(x, y, p) {
    if (p) {
        this._lcd_ctx.fillRect(x, y, 1, 1);
    } else {
        this._lcd_ctx.clearRect(x, y, 1, 1);
    }
};

JsWqx.prototype.updateLcd = function() {
    if (!this._lcd_ctx || !this.p_lcd) return;
    var p_lcd = this.p_lcd;
    var lcd_buff = this._lcd_buff;
    for (var y = 0; y < 80; y++) {
        for (var j = 0; j < 20; j++) {
            var offset = 20 * y + j;
            var old_pixel = lcd_buff[offset];
            var new_pixel = p_lcd[offset];
            var changed = old_pixel ^ new_pixel;
            if (changed) {
                lcd_buff[offset] = new_pixel;
                if (changed & 0x80) {
                    if (j > 0) {
                        this.putPixel(23 + j * 8, y, new_pixel & 0x80);
                    } else {

                    }
                }
                if (changed & 0x40) this.putPixel(23 + j * 8 + 1, y, new_pixel & 0x40);
                if (changed & 0x20) this.putPixel(23 + j * 8 + 2, y, new_pixel & 0x20);
                if (changed & 0x10) this.putPixel(23 + j * 8 + 3, y, new_pixel & 0x10);
                if (changed & 0x08) this.putPixel(23 + j * 8 + 4, y, new_pixel & 0x08);
                if (changed & 0x04) this.putPixel(23 + j * 8 + 5, y, new_pixel & 0x04);
                if (changed & 0x02) this.putPixel(23 + j * 8 + 6, y, new_pixel & 0x02);
                if (changed & 0x01) this.putPixel(23 + j * 8 + 7, y, new_pixel & 0x01);
            }
        }
    }
};

JsWqx.prototype.frame = function() {
    var next_frame_cycles = ((this._frame_counter + 1) * (this.CPU_FREQ / this.PERFERED_FPS)) | 0;
    var CYCLES_TIMER0 = (this.CPU_FREQ / 2) | 0;
    var CYCLES_TIMER1 = (this.CPU_FREQ / 256) | 0;
    var next_timer0_cycles = ((this._timer0_counter + 1) * CYCLES_TIMER0) | 0;
    var next_timer1_cycles = ((this._timer1_counter + 1) * CYCLES_TIMER1) | 0;
    var should_irq = false;
    var cycles = this.cycles;
    while (cycles < next_frame_cycles) {
        cycles = (cycles + this.execute()) | 0;
        if (should_irq && !this.flag_i) {
            should_irq = false;
            this.irq();
        }
        if (cycles >= next_timer0_cycles) {
            next_timer0_cycles += CYCLES_TIMER0;
            this._timer0_counter = (this._timer0_counter + 1) | 0;
            if (!(this._timer0_counter & 0x01)) {
                this.adjustTime();
            }
            if (!this.encounterIRQClock() || (this._timer0_counter & 0x01)) {
                this.p_io[0x3D] = 0;
            } else {
                this.p_io[0x3D] = 0x20;
                this.clock_flags &= 0xFD;
            }
        }
        if (cycles >= next_timer1_cycles) {
            next_timer1_cycles = (next_timer1_cycles + CYCLES_TIMER1) | 0;
            this._timer1_counter = (this._timer1_counter + 1) | 0;
            this.clock_buff[4]++;
            this.p_io[0x01] |= 0x08;
            should_irq = true;
        }
    }
    this._frame_counter = (this._frame_counter + 1) | 0;
    this.cycles = cycles;
    this.updateLcd();
};

JsWqx.prototype.play = function() {
    if (!this._frame_timer) {
        this._frame_timer = setInterval(
            this.frame.bind(this), 1000 / this.PERFERED_FPS);
    }
};

JsWqx.prototype.stop = function() {
    if (this._frame_timer) {
        clearInterval(this._frame_timer);
        this._frame_timer = 0;
    }
};