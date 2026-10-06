param()

Add-Type -AssemblyName Microsoft.VisualBasic
$task = [Microsoft.VisualBasic.Interaction]::InputBox("Kya task karwana hai Ruflo Swarm se?`n`n(Example: 'HomeScreen ko refactor karo' ya 'Firebase bug fix karo')", "Ruflo AI Swarm", "")

if (![string]::IsNullOrWhiteSpace($task)) {
    Write-Host ""
    Write-Host "🚀 Swarm ko task diya jaa raha hai: $task" -ForegroundColor Green
    Write-Host "--------------------------------------------------------"
    npx ruflo swarm start -o $task
} else {
    Write-Host "❌ Task cancel kar diya gaya." -ForegroundColor Yellow
}