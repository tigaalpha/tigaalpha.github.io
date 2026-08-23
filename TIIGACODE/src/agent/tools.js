import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { globSearch, listAllFiles } from '../utils/glob.js';

const execFileAsync = promisify(execFile);

function toAbs(path) {
  return resolve(process.cwd(), path ?? '.');
}

export const TOOLS = {
  read_file: {
    dangerous: false,
    schema: {
      name: 'read_file',
      description: 'อ่านเนื้อหาไฟล์ข้อความ พร้อมเลขบรรทัด รองรับการอ่านเฉพาะช่วงบรรทัดด้วย offset/limit',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'พาธของไฟล์ (relative หรือ absolute)' },
          offset: { type: 'number', description: 'เริ่มอ่านจากบรรทัดที่เท่าไร (เริ่มที่ 1)' },
          limit: { type: 'number', description: 'จำนวนบรรทัดสูงสุดที่จะอ่าน' },
        },
        required: ['path'],
      },
    },
    async execute({ path, offset = 1, limit = 2000 }) {
      const content = readFileSync(toAbs(path), 'utf8');
      const lines = content.split('\n');
      // ไฟล์ข้อความเกือบทั้งหมดจบด้วย \n ซึ่งทำให้ split ได้ element ว่างหลอกๆ ต่อท้าย
      // (เช่น "a\nb\n" -> ['a','b','']) ตัดทิ้งเพื่อไม่ให้เลขบรรทัดเกินจำนวนบรรทัดจริง
      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      const start = Math.max(0, offset - 1);
      return lines
        .slice(start, start + limit)
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join('\n');
    },
  },

  list_dir: {
    dangerous: false,
    schema: {
      name: 'list_dir',
      description: 'แสดงรายชื่อไฟล์และโฟลเดอร์ย่อยใน path ที่ระบุ (ไม่ recursive)',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'พาธของโฟลเดอร์' } },
        required: ['path'],
      },
    },
    async execute({ path }) {
      const entries = readdirSync(toAbs(path), { withFileTypes: true });
      return entries
        .map((e) => `${e.isDirectory() ? '[dir] ' : '[file]'} ${e.name}`)
        .sort()
        .join('\n');
    },
  },

  glob: {
    dangerous: false,
    schema: {
      name: 'glob',
      description: 'ค้นหาไฟล์ด้วย glob pattern เช่น "src/**/*.js" หรือ "*.md"',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'glob pattern' },
          path: { type: 'string', description: 'โฟลเดอร์ที่จะเริ่มค้นหา (default: โฟลเดอร์ปัจจุบัน)' },
        },
        required: ['pattern'],
      },
    },
    async execute({ pattern, path }) {
      const matches = globSearch(pattern, toAbs(path ?? '.'));
      return matches.length ? matches.join('\n') : '(ไม่พบไฟล์ที่ตรงกับ pattern)';
    },
  },

  grep: {
    dangerous: false,
    schema: {
      name: 'grep',
      description: 'ค้นหาข้อความ/regex ในไฟล์ทั้งหมดใต้โฟลเดอร์ที่ระบุ คืนค่า file:line:เนื้อหา',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'regex pattern ที่จะค้นหา' },
          path: { type: 'string', description: 'โฟลเดอร์ที่จะเริ่มค้นหา (default: โฟลเดอร์ปัจจุบัน)' },
        },
        required: ['pattern'],
      },
    },
    async execute({ pattern, path }) {
      const root = toAbs(path ?? '.');
      const files = listAllFiles(root);
      const re = new RegExp(pattern);
      const results = [];
      for (const file of files) {
        let text;
        try {
          text = readFileSync(join(root, file), 'utf8');
        } catch {
          continue;
        }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            results.push(`${file}:${i + 1}:${lines[i]}`);
            if (results.length >= 200) return results.join('\n');
          }
        }
      }
      return results.length ? results.join('\n') : '(ไม่พบข้อความที่ตรงกัน)';
    },
  },

  write_file: {
    dangerous: true,
    schema: {
      name: 'write_file',
      description: 'เขียนไฟล์ทั้งไฟล์ (สร้างใหม่หรือเขียนทับ) — สร้างโฟลเดอร์ parent ให้อัตโนมัติ',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'พาธของไฟล์ที่จะเขียน' },
          content: { type: 'string', description: 'เนื้อหาทั้งหมดของไฟล์' },
        },
        required: ['path', 'content'],
      },
    },
    async execute({ path, content }) {
      const abs = toAbs(path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      return `เขียนไฟล์แล้ว: ${path} (${content.length} ตัวอักษร)`;
    },
  },

  edit_file: {
    dangerous: true,
    schema: {
      name: 'edit_file',
      description:
        'แก้ไขไฟล์ที่มีอยู่แล้วด้วยการแทนที่ข้อความ old_string ด้วย new_string — old_string ต้องพบแค่ 1 ครั้งในไฟล์ เว้นแต่ตั้ง replace_all เป็น true',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'พาธของไฟล์ที่จะแก้ไข' },
          old_string: { type: 'string', description: 'ข้อความเดิมที่จะถูกแทนที่' },
          new_string: { type: 'string', description: 'ข้อความใหม่' },
          replace_all: { type: 'boolean', description: 'แทนที่ทุกจุดที่พบ (default: false)' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
    async execute({ path, old_string: oldString, new_string: newString, replace_all: replaceAll = false }) {
      const abs = toAbs(path);
      const content = readFileSync(abs, 'utf8');
      const count = content.split(oldString).length - 1;
      if (count === 0) throw new Error(`ไม่พบ old_string ในไฟล์ ${path}`);
      if (count > 1 && !replaceAll) {
        throw new Error(`old_string พบ ${count} ครั้งในไฟล์ — ระบุข้อความให้จำเพาะขึ้น หรือส่ง replace_all: true`);
      }
      const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
      writeFileSync(abs, updated, 'utf8');
      return `แก้ไขไฟล์แล้ว: ${path} (${count} จุด)`;
    },
  },

  run_bash: {
    dangerous: true,
    schema: {
      name: 'run_bash',
      description: 'รันคำสั่ง shell (ผ่าน bash -lc) แล้วคืนค่า stdout/stderr — ใช้เมื่อจำเป็นเท่านั้น เช่นรันเทส หรือคำสั่ง git',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'คำสั่ง shell ที่จะรัน' },
          cwd: { type: 'string', description: 'โฟลเดอร์ที่จะรันคำสั่ง (default: โฟลเดอร์ปัจจุบัน)' },
        },
        required: ['command'],
      },
    },
    async execute({ command, cwd }) {
      try {
        const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
          cwd: cwd ? toAbs(cwd) : process.cwd(),
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return [stdout, stderr].filter(Boolean).join('\n---stderr---\n') || '(ไม่มี output)';
      } catch (err) {
        const stdout = err.stdout ?? '';
        const stderr = err.stderr ?? err.message;
        return `คำสั่งล้มเหลว (exit ${err.code ?? '?'})\n${stdout}\n---stderr---\n${stderr}`;
      }
    },
  },
};

export function getToolSchemas() {
  return Object.values(TOOLS).map((t) => t.schema);
}
