const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'catalog.json');

const files = fs.readdirSync(rootDir).sort();
const flows = files.filter((file) => file.endsWith('.flows'));
const media = files.filter((file) => /\.(png|jpg|gif)$/.test(file));

const readFlow = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

const parseStringValue = (content, key) => {
  const match = content.match(new RegExp(`(?:^|\\n)${key}\\s*=\\s*"([^"]+)"`));
  return match ? match[1] : '';
};

const parseMultilineValue = (content, key) => {
  const match = content.match(new RegExp(`${key}\\s*=\\s*"""([\\s\\S]*?)"""`));
  return match ? match[1].trim() : '';
};

const parseArray = (value) => {
  const strMatches = value.match(/"([^"]*)"/g);
  return strMatches
    ? strMatches.map((item) => item.slice(1, -1))
    : value.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
};

const parseValue = (value, { booleans = false } = {}) => {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  if (booleans && value === 'true') {
    return true;
  }

  if (booleans && value === 'false') {
    return false;
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseArray(value);
  }

  return value;
};

const parseKeyValueBlock = (block, options) => {
  const parsed = {};

  block.split('\n').forEach((line) => {
    const keyValue = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(.+?)\s*$/);
    if (!keyValue) {
      return;
    }

    parsed[keyValue[1].trim()] = parseValue(keyValue[2].trim(), options);
  });

  return parsed;
};

const parseNamedBlock = (content, blockName, options) => {
  const match = content.match(new RegExp(`\\[${blockName}\\]([\\s\\S]*?)(?=\\n\\[|$)`));
  return match ? parseKeyValueBlock(match[1], options) : {};
};

const parseParams = (content) => {
  const paramMatches = content.match(/\[\[param\]\]([\s\S]*?)(?=\n\[|$)/g);
  if (!paramMatches) {
    return [];
  }

  return paramMatches
    .map((block) => parseKeyValueBlock(block, { booleans: true }))
    .filter((param) => param.id);
};

const catalog = flows.map((file) => {
  const content = readFlow(file);
  const baseName = file.substring(0, file.lastIndexOf('.'));
  const matchingMedia = media.find((mediaFile) => mediaFile.startsWith(`${baseName}.`));

  return {
    uid: parseStringValue(content, 'uid'),
    title: parseStringValue(content, 'title') || 'Untitled',
    subtitle: parseStringValue(content, 'subtitle'),
    description: parseMultilineValue(content, 'description'),
    script: parseMultilineValue(content, 'script'),
    category: parseStringValue(content, 'category') || 'Utilities',
    appUrl: parseStringValue(content, 'appUrl') || null,
    manifest: parseNamedBlock(content, 'manifest'),
    config: parseNamedBlock(content, 'config'),
    param: parseParams(content),
    mediaUrl: matchingMedia ? `https://moosylog.github.io/flows4json/${matchingMedia}` : null,
  };
});

fs.writeFileSync(outputFile, JSON.stringify(catalog, null, 2));

console.log(`Wrote ${path.relative(process.cwd(), outputFile)} with ${catalog.length} flows`);
