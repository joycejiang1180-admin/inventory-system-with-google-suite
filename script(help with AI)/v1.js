============================================
// Multi-Category Inventory System - Main Script
// 🏪 多品类库存管理系统 - 完整脚本
// 四大核心功能：                   Core Functions:
// 1. 通用提交 (品类)               Universal Submission (Category)
// 2. 直接编辑日志 (onEdit触发器)    Direct Edit Logger(onEdit Trigger)  
// 3. 主数据库同步                  Master Database Sync
// 4. 统一管理菜单                  Unified Management Menu
// ============================================

/**
 * 通用库存操作提交函数 (用于所有品类) Universal function for submitting inventory operations
 * @param {string} category - 品类，如 'BEER' 或 'WINE'
 */
// ===== 1. 核心：通用库存提交函数 ===== Universal Inventory Submission
function submitInventoryOperations(category) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 品类配置：在这里定义或添加新品类！
  var config = {// 脾酒配置
    'BEER': {
      inputSheetName: 'Input_Beer',
      dbSheetName: 'Database_Beer',
      unit: 'case(s)',
      operatorCell: 'B2',
      dataStartRow: 6 // 注意：起始行可，请根据您的表确认 confirm matches base on your sheet
    },
    'WINE': { // 葡萄酒配置
      inputSheetName: 'Input_Wine',
      dbSheetName: 'Database_Wine',
      unit: 'bottle(s)',
      operatorCell: 'B2',
      dataStartRow: 6 // 注意：起始行可，请根据您的表确认 confirm matches base on your sheet
    }
  };
  
  var currentConfig = config[category];
  if (!currentConfig) {
    SpreadsheetApp.getUi().alert('Error', 'Configuration for category "' + category + '" not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  var inputSheet = ss.getSheetByName(currentConfig.inputSheetName);
  var dbSheet = ss.getSheetByName(currentConfig.dbSheetName);
  var logSheet = ss.getSheetByName('Master_Log');
  
  if (!inputSheet || !dbSheet || !logSheet) {
    SpreadsheetApp.getUi().alert('Error', 'Required sheet not found. Please check sheet names.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  // 2. 获取操作员 getOperator
  var operator = inputSheet.getRange(currentConfig.operatorCell).getValue();
  if (!operator) operator = 'Operator_Not_Specified';
  
  // 3. 获取输入数据 getInputData
  var startRow = currentConfig.dataStartRow;
  var lastRow = inputSheet.getLastRow();
  if (lastRow < startRow) {
    SpreadsheetApp.getUi().alert('Info', 'No data found to submit.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  var dataRange = inputSheet.getRange(startRow, 1, lastRow - startRow + 1, 2).getValues();
  var updates = [];
  var errors = [];
  
  // 4. 处理每一行数据 through each row data
  for (var i = 0; i < dataRange.length; i++) {
    var rowData = dataRange[i];
    var product = rowData[0];
    var qty = rowData[1];
    
    if (!product || qty === '') continue;
    if (isNaN(qty)) {
      errors.push('Row ' + (startRow + i) + ': Quantity "' + qty + '" is not a valid number.');
      continue;
    }
    
    var productList = dbSheet.getRange('A2:A').getValues().flat();
    var dbRowIndex = productList.indexOf(product) + 2;
    
    if (dbRowIndex < 2) {
      errors.push('Row ' + (startRow + i) + ': Product "' + product + '" not found in database.');
      continue;
    }
    
    var currentStock = dbSheet.getRange(dbRowIndex, 4).getValue();
    var newStock = currentStock + Number(qty);
    
    if (newStock < 0) {
      errors.push('Row ' + (startRow + i) + ': Operation would make stock negative (' + newStock + ').');
      continue;
    }
    
    var actionType = qty >= 0 ? 'RESTOCK' : 'CONSUME';
    updates.push({
      dbRow: dbRowIndex,
      product: product,
      quantityChange: qty,
      oldStock: currentStock,
      newStock: newStock,
      action: actionType
    });
  }
  
  // 5. 错误处理 error alter
  if (errors.length > 0) {
    SpreadsheetApp.getUi().alert('Submission Errors', errors.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  if (updates.length === 0) {
    SpreadsheetApp.getUi().alert('Info', 'No valid operations to submit.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  // 6. 批量更新数据库和日志 updated database and log
  updates.forEach(function(update) {
    dbSheet.getRange(update.dbRow, 4).setValue(update.newStock);
    dbSheet.getRange(update.dbRow, 7).setValue(new Date());
    
    logSheet.appendRow([
      new Date(),
      operator,
      category,
      update.product,
      update.action,
      update.oldStock,
      update.newStock,
      'Qty Change: ' + update.quantityChange + ' ' + currentConfig.unit
    ]);
  });
  
  // 7. 清空输入区域并提示成功 clear out input section
  inputSheet.getRange(startRow, 1, lastRow - startRow + 1, 2).clearContent();
  
  var successMsg = '✅ Successfully submitted ' + updates.length + ' operation(s) for ' + category + '.\n\nSummary:';
  updates.forEach(function(update, idx) {
    successMsg += '\n' + (idx + 1) + '. ' + update.product + ': ' + update.oldStock + ' → ' + update.newStock + ' (' + update.action + ')';
  });
  SpreadsheetApp.getUi().alert('Submission Complete', successMsg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 为菜单创建的专用包装函数（直接调用通用函数）
 */
function submitBeerOperations() {
  submitInventoryOperations('BEER');
}
function submitWineOperations() {
  submitInventoryOperations('WINE');
}
// ============================================
// ===== 2. 核心：直接编辑自动记录 (onEdit触发器) ===== Direct Edit Auto-Logger
function onEdit(e) {
  var sheetsToWatch = [
    { name: 'Database_Beer', stockCol: 4, unit: 'case(s)', category: 'BEER', operatorCell: 'K6' },
    { name: 'Database_Wine', stockCol: 4, unit: 'bottle(s)', category: 'WINE', operatorCell: 'K6' }
  ];
  var range = e.range;
  var sheet = range.getSheet();
  var editedColumn = range.getColumn();
  var editedRow = range.getRow();
  for (var i = 0; i < sheetsToWatch.length; i++) {
    var config = sheetsToWatch[i];
    if (sheet.getName() === config.name && editedColumn === config.stockCol && editedRow > 1) {
      var oldValue = e.oldValue;
      var newValue = e.value;
      var productName = sheet.getRange(editedRow, 1).getValue();
      var operator = sheet.getRange(config.operatorCell).getValue() || e.user.getEmail();
      var change = newValue - oldValue;
      var logSheet = e.source.getSheetByName('Master_Log');
      if (logSheet) {
        logSheet.appendRow([
          new Date(),
          operator,
          config.category,
          productName,
          'DIRECT_EDIT',
          oldValue,
          newValue,
          (change > 0 ? 'Manual Increase' : 'Manual Decrease') + ', Change: ' + change + ' ' + config.unit
        ]);
        sheet.getRange(editedRow, 7).setValue(new Date());
      }
      break;
    }
  }
}
// ============================================
// ===== 3. 核心：主数据库同步函数 =====  Master Database Sync
function updateMasterDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var categoryConfig = {
    'BEER': { sheetName: 'Database_Beer', unit: 'case(s)' },
    'WINE': { sheetName: 'Database_Wine', unit: 'bottle(s)' }
  };
  var allData = [];
  for (var categoryName in categoryConfig) {
    var config = categoryConfig[categoryName];
    var sourceSheet = ss.getSheetByName(config.sheetName);
    if (sourceSheet) {
      var lastRow = sourceSheet.getLastRow();
      if (lastRow > 1) {
        var dataRange = sourceSheet.getRange(2, 1, lastRow - 1, 7).getValues();
        for (var i = 0; i < dataRange.length; i++) {
          var row = dataRange[i];
          var productName = row[0];
          if (productName) {
            var brand = row[2] || 'N/A';
            var stock = row[3];
            var lastUpdated = row[6];
            var formattedUnit = stock + '/' + config.unit;
            allData.push([categoryName, productName, brand, stock, formattedUnit, lastUpdated]);
          }
        }
      }
    }
  }
  if (allData.length > 0) {
    allData.sort(function(a, b) {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      return a[1] < b[1] ? -1 : 1;
    });
  }
  var targetSheet = ss.getSheetByName('Master_Database') || ss.insertSheet('Master_Database');
  if (targetSheet.getLastRow() > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, 6).clearContent();
  }
  if (allData.length > 0) {
    targetSheet.getRange(2, 1, allData.length, 6).setValues(allData);
  }
  var operatorCell = targetSheet.getRange('J2');
  var operator = operatorCell.getValue() || 'System_Click_Sync';
  var logSheet = ss.getSheetByName('Master_Log');
  if (logSheet) {
    logSheet.appendRow([
      new Date(),
      operator,
      'SYSTEM',
      'Master Database Sync',
      'FULL_UPDATE',
      '-',
      allData.length,
      'Synced ' + Object.keys(categoryConfig).length + ' categories'
    ]);
  }
  SpreadsheetApp.getUi().alert('Sync Complete', '✅ Synced ' + allData.length + ' items to Master_Database.\nOperator: ' + operator, SpreadsheetApp.getUi().ButtonSet.OK);
}
// ============================================
// ===== 4. 核心：统一管理菜单 ===== Management Menu
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🏪 Inventory System')
    .addItem('Submit Beer Operations', 'submitBeerOperations')
    .addItem('Submit Wine Operations', 'submitWineOperations')
    .addSeparator()
    .addItem('Sync to Master Database', 'updateMasterDatabase')
    .addToUi();
}
// ============================================
