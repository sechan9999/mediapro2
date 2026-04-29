# generate-audio.ps1 - Media Hub Pro TTS Narration Generator
# Run from inside mediapro-intro folder:
#   cd mediapro-intro
#   .\generate-audio.ps1

Write-Host ""
Write-Host "== Media Hub Pro - TTS Narration Generator ==" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Installing kokoro-onnx TTS engine..." -ForegroundColor Yellow
pip install kokoro-onnx soundfile --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: pip install error. Requires Python 3.9+" -ForegroundColor Red
    exit 1
}
Write-Host "      Done." -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] Generating narration audio (af_heart voice)..." -ForegroundColor Yellow
Write-Host "      This takes about 1-2 minutes..."
npx hyperframes tts narration.txt --voice af_heart --speed 1.05 --output assets/narration.wav
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: TTS generation error." -ForegroundColor Red
    exit 1
}
Write-Host "      Saved: assets/narration.wav" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Re-rendering with audio..." -ForegroundColor Yellow
npx hyperframes render -o ../renders/mediapro-intro.mp4

Write-Host ""
Write-Host "Done! Output: ../renders/mediapro-intro.mp4" -ForegroundColor Cyan
