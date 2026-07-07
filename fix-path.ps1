$old = [Environment]::GetEnvironmentVariable("Path", "User")
$cleaned = $old
  -replace [regex]::Escape("%USERPROFILE%\.bun\bin;"), ""
  -replace [regex]::Escape("C:\Users\Administrator\.bun\bin;"), ""
$new = "C:\Users\Administrator\.bun\bin;" + $cleaned
[Environment]::SetEnvironmentVariable("Path", $new, "User")
Write-Output "PATH cleaned and updated"
[Environment]::GetEnvironmentVariable("Path", "User") -split ";" | Select-Object -First 5
