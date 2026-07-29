export function parseExcelMatrixFormat(rows, headerRowIdx, ipcColumns, projectId) {
    let newItems = [];
    let currentPackageName = "";

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        
        const nextRow = rows[i+1] || [];
        let isBlockStart = false;
        
        for (let c = 0; c < 5 && c < nextRow.length; c++) {
            const nextCellVal = (nextRow[c] || "").toString().trim().toLowerCase();
            if (nextCellVal.includes("% workdone") || nextCellVal.includes("% work done") || nextCellVal.includes("progress")) {
                isBlockStart = true;
                break;
            }
        }

        if (isBlockStart) {
            const colBVal = (row[1] || "").toString().trim();
            if (colBVal) {
                currentPackageName = colBVal;
            }
            
            let pkgName = currentPackageName;

            const titleRow = rows[i] || [];
            const progRow = rows[i+1] || [];
            const wdRow = rows[i+2] || [];
            const retRow = rows[i+3] || [];
            const apRow = rows[i+4] || [];
            const netRow = rows[i+5] || [];

            ipcColumns.forEach(mh => {
                const colIdx = mh.index;
                const titleRaw = (titleRow[colIdx] || "").toString().trim();
                
                let workdone = parseFloat(wdRow[colIdx]) || 0;
                let net_certified = parseFloat(netRow[colIdx]) || 0;
                let titleUpper = titleRaw.toUpperCase();
                let isAdvance = titleUpper.includes("ADVANCE") || titleUpper.includes("TẠM ỨNG");
                let isRelease1 = titleUpper.includes('TOC') || titleUpper.includes('PAC') || titleUpper.includes('RELEASE 1');
                let isRelease2 = titleUpper.includes('DLC') || titleUpper.includes('RELEASE 2');

                if (net_certified !== 0 || workdone !== 0 || isRelease1 || isRelease2 || (isAdvance && net_certified !== 0)) {
                    let codeToUse = titleRaw;
                    if (!codeToUse && !isAdvance && !isRelease1 && !isRelease2) {
                        codeToUse = "IPC-" + mh.dateStr.substring(5, 7); 
                    }
                    
                    let descToUse = codeToUse;
                    if (!isAdvance && !isRelease1 && !isRelease2) {
                        if (!descToUse.toLowerCase().includes("thanh toán") && !descToUse.toLowerCase().includes("ipc")) {
                            descToUse = "Thanh toán đợt " + codeToUse;
                        }
                    } else {
                        descToUse = isAdvance ? 'Advance Payment' : (isRelease1 ? 'Release Retention 1' : 'Release Retention 2');
                    }
                    
                    let item = {
                        id: 'cf-imp-' + Date.now() + '-' + Math.floor(Math.random()*10000) + colIdx,
                        project_id: projectId,
                        package_name: pkgName,
                        contract: pkgName,
                        code: codeToUse,
                        desc: descToUse,
                        date: mh.dateStr,
                        value: isAdvance ? net_certified : workdone,
                        progress_pct: parseFloat(progRow[colIdx]) || 0,
                        workdone: isAdvance ? 0 : workdone,
                        retention: parseFloat(retRow[colIdx]) || 0,
                        ap_recovery: parseFloat(apRow[colIdx]) || 0,
                        total_cert: net_certified,
                        status: 'Planned',
                        is_release_retention_1: isRelease1,
                        is_release_retention_2: isRelease2,
                        is_construction: true,
                        is_imported_matrix: true,
                        has_custom_retention: true,
                        has_custom_ap_recovery: true,
                        custom_retention: parseFloat(retRow[colIdx]) || 0,
                        custom_ap_recovery: parseFloat(apRow[colIdx]) || 0
                    };
                    newItems.push(item);
                }
            });

            i += 5; 
        }
    }
    return newItems;
}

export function parseExcelStandardFormat(rows, projectId, selectedContract) {
    let newItems = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;
        
        const pkgName = row[0] ? row[0].toString().trim() : '';
        const codeRaw = row[1] ? row[1].toString().trim() : '';
        const desc = row[2];
        const amountRaw = row[3];
        const dateRaw = row[4];
        
        if (!desc || amountRaw === undefined) continue;
        if (!codeRaw || codeRaw.length < 2) {
            if (!isNaN(codeRaw)) continue; 
        }
        
        let amount = parseFloat(amountRaw);
        if (isNaN(amount)) continue;
        
        let dateStr = "";
        if (dateRaw) {
            if (typeof dateRaw === 'number') {
                const dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                dateStr = dateObj.toISOString().split('T')[0];
            } else if (typeof dateRaw === 'string') {
                const parts = dateRaw.split('/');
                if (parts.length === 2) { 
                    dateStr = `\${parts[1]}-\${parts[0].padStart(2, '0')}-01`;
                } else if (parts.length === 3) { 
                    dateStr = `\${parts[2]}-\${parts[1].padStart(2, '0')}-\${parts[0].padStart(2, '0')}`;
                } else {
                    const d = new Date(dateRaw);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toISOString().split('T')[0];
                    }
                }
            }
        }
        
        newItems.push({
            id: 'cf-imp-' + Date.now() + '-' + Math.floor(Math.random()*10000) + i,
            project_id: projectId,
            package_name: pkgName || selectedContract,
            code: codeRaw,
            contract: selectedContract || pkgName,
            desc: desc.toString().trim(),
            date: dateStr,
            value: amount,
            status: 'Planned'
        });
    }
    return newItems;
}
