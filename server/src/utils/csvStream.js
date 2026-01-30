const csv = require('csv-parser');
const fs = require('fs');

module.exports = (filePath, onRow) =>
  new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', onRow)
      .on('end', resolve);
  });
