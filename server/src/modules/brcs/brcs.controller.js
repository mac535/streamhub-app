const fs = require('fs');
const path = require('path');

const brcsPath = path.join(__dirname, '../../../data/brcs.json');

const readData = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
};

const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

exports.getAllBrcs = (req, res) => {
  try {
    const brcs = readData(brcsPath);
    const { district } = req.query;
    if (district) {
      const filtered = brcs.filter(b => (b.district || '').toUpperCase() === district.toUpperCase());
      return res.json(filtered);
    }
    res.json(brcs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch BRCs', error: err.message });
  }
};

exports.updateBrc = (req, res) => {
  try {
    const { code } = req.params;
    const { name, district, location, inchargeName, issues } = req.body;
    const brcs = readData(brcsPath);
    
    const index = brcs.findIndex(b => b.code === code);
    if (index === -1) return res.status(404).json({ message: 'BRC not found' });

    brcs[index] = { ...brcs[index], name, district, location, inchargeName, issues };
    writeData(brcsPath, brcs);

    res.json({ message: 'BRC updated successfully', brc: brcs[index] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update BRC', error: err.message });
  }
};

