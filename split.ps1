$html = [IO.File]::ReadAllText("index.html")

function Extract-Block {
    param([string]$start, [string]$end)
    $idx1 = $html.IndexOf($start)
    if ($idx1 -lt 0) { return "" }
    $idx2 = $html.IndexOf($end, $idx1)
    if ($idx2 -lt 0) { return "" }
    return $html.Substring($idx1, $idx2 - $idx1 + $end.Length)
}

function Save-Block {
    param([string]$file, [string]$start, [string]$end)
    $content = Extract-Block -start $start -end $end
    if ($content) {
        [IO.File]::WriteAllText($file, $content)
    }
}

# Layout
Save-Block -file "components/sidebar.html" -start "<!-- Sidebar -->" -end "</aside>"
Save-Block -file "components/topbar.html" -start "<header class=`"topbar`">" -end "</header>"
Save-Block -file "components/project-header.html" -start "<div class=`"project-header`">" -end "</div>`r`n                </div>" 
# wait, the project-header end is tricky. 
# Better use specific lines or just do it by tag

# Modules
Save-Block -file "components/module-overview.html" -start "<div id=`"module-overview`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-budget.html" -start "<div id=`"module-budget`">" -end "</div>`r`n                </div>"
Save-Block -file "components/module-tender.html" -start "<div id=`"module-tender`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-contract.html" -start "<div id=`"contract-view`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-cashflow.html" -start "<div id=`"cashflow-view`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-payment.html" -start "<div id=`"module-payment`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-vo.html" -start "<div id=`"module-vo`"" -end "</div>`r`n                </div>"
Save-Block -file "components/module-final.html" -start "<div id=`"module-final`"" -end "</div>`r`n                </div>"

# Modals
Save-Block -file "components/modals/login.html" -start "<!-- Login Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/payment.html" -start "<!-- Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/new-entry.html" -start "<!-- New Entry Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/new-project.html" -start "<!-- New Project Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/new-tender.html" -start "<!-- New Tender Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/award-tender.html" -start "<!-- Award Tender Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/project-summary.html" -start "<!-- Project Summary Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/contract.html" -start "<!-- Contract Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/cashflow-detail.html" -start "<!-- Cashflow Detail Modal -->" -end "</div>`r`n    </div>"
Save-Block -file "components/modals/cashflow-import.html" -start "<!-- Cashflow Import Preview Modal -->" -end "</div>`r`n    </div>"

Write-Host "Split finished."
