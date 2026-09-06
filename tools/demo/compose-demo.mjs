import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ffmpeg = process.env.QBC_FFMPEG ?? 'ffmpeg';
const ffprobe = process.env.QBC_FFPROBE ?? 'ffprobe';
const chapters = JSON.parse(readFileSync('tools/demo/chapters.json', 'utf8'));
const probe = (path) =>
  JSON.parse(
    execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], {
      encoding: 'utf8',
    }),
  );
const run = (args) =>
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const time = (seconds) =>
  `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.000`;
mkdirSync('tmp/demo/encoded', { recursive: true });
mkdirSync('docs/media', { recursive: true });

let captions = 'WEBVTT\n\n';
let transcript =
  '# Demo transcript\n\n[Watch the video](media/qbc-grid-demo.mp4) · [Chapters and reproduction](demo.md)\n\n';
let metadata =
  ';FFMETADATA1\ntitle=qbc-grid — Five-minute feature walkthrough\nartist=qbc-grid contributors\n';
const clips = [];
for (const [index, chapter] of chapters.entries()) {
  const name = String(index + 1).padStart(2, '0');
  const source = `tmp/demo/scenes/${name}.webm`;
  const audio = `tmp/demo/audio/${name}.wav`;
  const sourceDuration = Number(probe(source).format.duration);
  const audioDuration = Number(probe(audio).format.duration);
  if (sourceDuration < 20)
    throw new Error(`Chapter ${name} has less than twenty seconds of capture.`);
  if (audioDuration > 19.5)
    throw new Error(`Chapter ${name} narration is ${audioDuration}s; shorten it before encoding.`);
  const output = `tmp/demo/encoded/${name}.mp4`;
  run([
    '-ss',
    String(sourceDuration - 20),
    '-i',
    source,
    '-i',
    audio,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-vf',
    'fps=25,format=yuv420p',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11,apad',
    '-t',
    '20',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-threads',
    '4',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    output,
  ]);
  clips.push(`file '${resolve(output).replaceAll('\\', '/')}'`);
  // Sentence-aligned caption windows are proportional to spoken word count.
  const sentences = chapter.narration.match(/[^.!?]+[.!?]+/g) ?? [chapter.narration];
  const totalWords = chapter.narration.split(/\s+/).length;
  let offset = 0;
  for (const sentence of sentences) {
    const duration = (sentence.trim().split(/\s+/).length / totalWords) * audioDuration;
    const stamp = (value) => new Date(value * 1000).toISOString().slice(11, 23);
    captions += `${stamp(index * 20 + offset)} --> ${stamp(index * 20 + offset + duration)}\n${sentence.trim()}\n\n`;
    offset += duration;
  }
  transcript += `## ${time(index * 20).slice(3, 8)} — ${chapter.title}\n\n${chapter.narration}\n\n`;
  metadata += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${index * 20000}\nEND=${(index + 1) * 20000}\ntitle=${chapter.title}\n`;
  console.log(`Encoded ${name}: 20s video, ${audioDuration.toFixed(2)}s narration`);
}
writeFileSync('tmp/demo/concat.txt', clips.join('\n'));
writeFileSync('tmp/demo/chapters.ffmetadata', metadata);
writeFileSync('docs/media/qbc-grid-demo.vtt', captions);
writeFileSync('docs/demo-transcript.md', transcript);
run([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  'tmp/demo/concat.txt',
  '-i',
  'tmp/demo/chapters.ffmetadata',
  '-i',
  'docs/media/qbc-grid-demo.vtt',
  '-map',
  '0:v',
  '-map',
  '0:a',
  '-map',
  '2:0',
  '-map_metadata',
  '1',
  '-map_chapters',
  '1',
  '-c:v',
  'copy',
  '-c:a',
  'copy',
  '-c:s',
  'mov_text',
  '-metadata:s:s:0',
  'language=eng',
  '-metadata:s:s:0',
  'title=English',
  '-t',
  '300',
  '-movflags',
  '+faststart',
  'docs/media/qbc-grid-demo.mp4',
]);
const result = probe('docs/media/qbc-grid-demo.mp4');
const duration = Number(result.format.duration);
if (Math.abs(duration - 300) > 0.1) throw new Error(`Expected 300 seconds, got ${duration}`);
if (
  !result.streams.some(
    (stream) => stream.codec_name === 'h264' && stream.width === 1600 && stream.height === 900,
  )
)
  throw new Error('Missing 1600 × 900 H.264 video');
if (!result.streams.some((stream) => stream.codec_name === 'aac'))
  throw new Error('Missing narration');
run(['-v', 'error', '-i', 'docs/media/qbc-grid-demo.mp4', '-f', 'null', '-']);
console.log(
  `Verified ${duration.toFixed(3)} seconds; ${(statSync('docs/media/qbc-grid-demo.mp4').size / 1024 / 1024).toFixed(1)} MiB; complete decode passed.`,
);
