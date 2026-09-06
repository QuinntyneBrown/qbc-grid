param([string]$Voice = 'Microsoft Zira Desktop')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$qbcSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$qbcSpeech.SelectVoice($Voice)
$qbcSpeech.Rate = 2
$qbcChapters = Get-Content -Raw -LiteralPath 'tools/demo/chapters.json' | ConvertFrom-Json
$qbcAudioDirectory = New-Item -ItemType Directory -Force -Path 'tmp/demo/audio'
try {
    for ($qbcIndex = 0; $qbcIndex -lt $qbcChapters.Count; $qbcIndex++) {
        $qbcAudioPath = Join-Path $qbcAudioDirectory.FullName ('{0:D2}.wav' -f ($qbcIndex + 1))
        $qbcSpeech.SetOutputToWaveFile($qbcAudioPath)
        $qbcSpeech.Speak($qbcChapters[$qbcIndex].narration)
        $qbcSpeech.SetOutputToNull()
        Write-Output ('Narrated chapter {0:D2}' -f ($qbcIndex + 1))
    }
} finally {
    $qbcSpeech.Dispose()
}
