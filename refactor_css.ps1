$mappings = [ordered]@{
    '#ffffff' = 'var(--card-bg)'
    '#f8fafc' = 'var(--main-bg)'
    '#f1f5f9' = 'var(--main-bg)'
    '#f9fafb' = 'var(--main-bg)'
    '#fafafa' = 'var(--main-bg)'
    '#fff7ed' = 'var(--status-orange-bg)'
    '#ffedd5' = 'var(--status-orange-bg)'
    '#f0fdf4' = 'var(--status-green-bg)'
    '#dcfce7' = 'var(--status-green-bg)'

    '#e2e8f0' = 'var(--border-color)'
    '#cbd5e1' = 'var(--border-color)'
    '#e5e7eb' = 'var(--border-color)'
    '#d1d5db' = 'var(--border-color)'
    '#bbf7d0' = 'var(--border-color)'
    '#fed7aa' = 'var(--border-color)'

    '#1e293b' = 'var(--text-dark)'
    '#0f172a' = 'var(--text-dark)'
    '#64748b' = 'var(--text-muted)'
    '#4b5563' = 'var(--text-muted)'

    '#166534' = 'var(--status-green-text)'
    '#9a3412' = 'var(--status-orange-text)'
    '#c2410c' = 'var(--status-orange-text)'

    '#a82e1c' = 'var(--primary-brand)'
    '#c63a25' = 'var(--primary-brand)'
    '#b45309' = 'var(--primary-orange)'
    '#92400e' = 'var(--primary-orange)'
}

$files = Get-ChildItem -Path . -Recurse -Include *.css | Where-Object { $_.Name -ne 'base.css' }

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content
    foreach ($key in $mappings.Keys) {
        $pattern = "(?i)" + $key + "\b"
        $content = [regex]::Replace($content, $pattern, $mappings[$key])
    }
    if ($content -cne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated $($file.Name)"
    }
}
Write-Host "Done"
