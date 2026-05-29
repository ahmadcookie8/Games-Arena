import fs from 'fs'
import path from 'path'

const WORD_LIST_PATH = path.resolve(__dirname, '../../node_modules/word-list/words.txt')

const COMMON_ABBREVIATIONS = new Set([
  // Time & Date
  'ad', 'am', 'pm', 'asap', 'eta', 'eol', 'utc', 'gmt', 'pst', 'est', 'cst', 'mst',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  
  // Business & Professional
  'ceo', 'cfo', 'cto', 'cio', 'coo', 'hr', 'ir', 'pr', 'qa', 'ux', 'ui', 'iot', 'ml', 'ai',
  'mba', 'llm', 'phd', 'md', 'rn', 'dds', 'dvm', 'pa', 'np',
  'inc', 'llc', 'ltd', 'plc', 'corp', 'co', 'pp', 'esq',
  'kpi', 'roi', 'ebitda', 'gpd', 'gni', 'gdpr', 'sla', 'nda', 'ip', 'cv', 'cpa',
  'cpa', 'cfp', 'dba', 'edi', 'erp', 'crm', 'b2b', 'b2c', 'g2g', 'p2p',
  
  // Internet & Technology
  'http', 'https', 'url', 'www', 'html', 'css', 'js', 'xml', 'json', 'api', 'sdk', 'ide',
  'sql', 'dba', 'db', 'nosql', 'vm', 'vps', 'cdn', 'vpn', 'vpn', 'ssl', 'tls', 'ssh', 'ftp', 'sftp',
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'avi', 'mkv', 'flv',
  'usb', 'ssd', 'hdd', 'ram', 'rom', 'cpu', 'gpu', 'soc', 'asic', 'fpga',
  'ai', 'ml', 'dl', 'nlp', 'cv', 'cv', 'gan', 'rnn', 'lstm', 'cnn', 'bert', 'llm', 'rag',
  'html5', 'css3', 'es6', 'rest', 'soap', 'rpc', 'graphql', 'websocket',
  'seo', 'sem', 'ppc', 'cpc', 'ctr', 'cpm', 'roas',
  
  // Common Abbreviations & Slang
  'etc', 'eg', 'ie', 'vs', 'vs.', 'viz', 'n.b', 'nb', 'ps', 'pp', 'approx',
  'btw', 'omg', 'omfg', 'lol', 'rofl', 'lmao', 'smh', 'tbh', 'imo', 'imho', 'fyi', 'fwiw',
  'asap', 'asof', 'bc', 'bc.', 'bc/', 'w/', 'w/o', 'pls', 'thx', 'thru', 'tho', 'u', 'ur',
  'gonna', 'wanna', 'gotta', 'sorta', 'kinda', 'y', 'n', 'ok', 'okay', 'yeah', 'nope',
  
  // Government & Organizations
  'fbi', 'cia', 'nsa', 'dhs', 'tsa', 'epa', 'usda', 'nasa', 'noaa', 'fcc', 'sec', 'ftc',
  'un', 'nato', 'unesco', 'who', 'imf', 'world bank', 'osha', 'eeoc', 'irs', 'va', 'ss',
  'dod', 'doj', 'dod', 'usps', 'dmv', 'aaa', 'aarp',
  
  // Sports & Organizations
  'nfl', 'nba', 'nhl', 'mlb', 'mls', 'wnba', 'epl', 'nfl', 'ncaa', 'afc', 'nfc', 'alcs', 'nlcs',
  
  // Units & Measurements
  'kg', 'g', 'mg', 'l', 'ml', 'oz', 'lb', 'lbs', 'in', 'ft', 'yd', 'mi', 'km', 'cm', 'mm',
  'mph', 'kph', 'rpm', 'psi', 'pa', 'bar', 'atm', 'db', 'db',
  'f', 'c', 'k', 'v', 'a', 'w', 'wh', 'kwh', 'hz', 'khz', 'mhz', 'ghz', 'byte', 'kb', 'mb', 'gb', 'tb', 'pb',
  
  // Medical & Health
  'bp', 'hr', 'rr', 'temp', 'bpm', 'cbc', 'ekg', 'ecg', 'eeg', 'mri', 'ct', 'xray', 'ct', 'ultrasound',
  'ob', 'gyn', 'obgyn', 'er', 'icu', 'ccu', 'nicu', 'pacu', 'icd', 'cvd', 'dsvt', 'std', 'std', 'std',
  'aids', 'hiv', 'tb', 'mrsa', 'uti', 'sti', 'gerd', 'oas', 'ptsd', 'ocd', 'adhd', 'add', 'asd', 'ibs',
  'covid', 'covid19', 'rna', 'dna', 'pcr', 'rt-pcr', 'mrna', 'dna',
  'cpr', 'als', 'bls', 'acls', 'pals', 'emt', 'paramedic',
  
  // Food & Drink
  'blt', 'msg', 'gmo', 'bpa', 'fda', 'usda',
  'za', 'pie', 'pho', 'ramen', 'sushi', 'taco', 'gyro', 'falafel', 'curry', 'dal', 'chow mein',
  'vodka', 'gin', 'rum', 'whiskey', 'tequila', 'sake', 'wine', 'beer', 'cider', 'mead',
  'bacon', 'ham', 'spam', 'tofu', 'tempeh', 'seitan', 'edamame',
  'bagel', 'brie', 'cheddar', 'feta', 'gouda', 'mozzarella', 'parmesan',
  'soda', 'oj', 'coffee', 'espresso', 'latte', 'cappuccino', 'macchiato', 'americano',
  'iced tea', 'kombucha', 'smoothie', 'milkshake', 'protein shake',
  'pizza', 'burger', 'hotdog', 'sandwich', 'wrap', 'burrito', 'enchilada', 'quesadilla',
  'salad', 'pasta', 'rice', 'noodles', 'bread', 'cereal', 'granola', 'yogurt', 'pudding',
  'candy', 'chocolate', 'licorice', 'gum', 'candy cane', 'lollipop', 'gummy',
  'appetizer', 'entree', 'dessert', 'snack', 'treat',
  'vegan', 'vegetarian', 'pescatarian', 'omnivore', 'carnivore',
  'organic', 'gluten-free', 'gf', 'keto', 'paleo', 'whole30',
  'bbq', 'bbq', 'grilled', 'baked', 'fried', 'steamed', 'boiled', 'sauteed', 'roasted',
  
  // Acronyms/Science
  'dna', 'rna', 'atp', 'gtp', 'amp', 'nadh', 'fadh2', 'ph', 'pka', 'pkb',
  'scuba', 'laser', 'radar', 'sonar', 'awol', 'snafu',
  'roygbiv', 'thc', 'cbd', 'mdma', 'lsd', 'pcp', 'mda',
  
  // Finance & Economics
  'gdp', 'gnp', 'gni', 'cpi', 'ppi', 'pce', 'nfi', 'roe', 'roa', 'roe',
  'sec', 'sec', 'sec', 'sec', 'sec',
  'stock', 'bond', 'etf', 'mutual fund', 'reit', 'ipo', 'spac', 'ipo', 'etf', 'mutual fund',
  'apy', 'apr', 'ir', 'libor', 'sofr', 'fomc', 'fed', 'ecb', 'boe', 'boj', 'pboc',
  'usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf',
  '401k', 'ira', 'roth', 'sep', 'simple', 'pension', 'deferred comp',
  
  // Legal
  'esq', 'll.b', 'llb', 'jd', 'juris doctor', 'sc', 'sd', 'nd', 'md', 'de',
  'dui', 'dwi', 'dwd', 'misdemeanor', 'felony', 'homicide', 'assault',
  'sue', 'tort', 'breach', 'contract', 'damages',
  
  // Music
  'dj', 'ep', 'lp', 'single', 'ft', 'feat', 'remix', 'acapella', 'dub',
  'bpm', 'eq', 'eq', 'daw', 'vst', 'au', 'aax',
  
  // Gaming & Entertainment
  'rpg', 'fps', 'moba', 'rts', 'mmo', 'mmorpg', 'pvp', 'pve', 'co-op', 'ai', 'npc',
  'gpu', 'gpu', 'fps', 'hz', 'vr', 'ar', 'mr', 'xr', 'haptic',
  'dlc', 'drm', 'tos', 'eula', 'mmorpg',
  
  // Networking
  'ip', 'tcp', 'udp', 'icmp', 'dhcp', 'dns', 'bgp', 'ospf', 'eigrp', 'rip',
  'lan', 'wan', 'vpn', 'vlan', 'mpls', 'bgp', 'igp', 'egp',
  'mac', 'mac address', 'ip address', 'gateway', 'router',
  'qos', 'tos', 'dscp', 'cfi', 'mpls',
  
  // Architecture/Building
  'hvac', 'plumbing', 'hvac', 'hvac',
  'gis', 'gps', 'glonass', 'beidou',
  'cad', 'cam', 'cad/cam', 'bim', 'cfd', 'fem', 'fea',
  
  // Academic
  'phd', 'masters', 'ba', 'bs', 'bsc', 'bse', 'ma', 'ms', 'msc', 'mse',
  'gpa', 'sat', 'act', 'gre', 'gmat', 'lsat', 'mcat',
  'ap', 'ib', 'ged', 'asvab',
  
  // General/Misc
  'atm', 'av', 'id', 'pin', 'sim', 'imei', 'imsi',
  'diy', 'tv', 'dvd', 'blu-ray', 'hdmi', 'rca', 'toslink',
  'ac', 'dc', 'watts', 'amps', 'ohms', 'volts',
  'gps', 'glonass', 'beidou', 'galileo',
  'ufo', 'e.t', 'et', 'asci',
  'rsvp', 'sos', 'vip', 'vip', 'mvp',
  'wifi', 'bluetooth', 'nfc', 'infrared', 'ble',
  'ok', 'okay', 'yes', 'no', 'na', 'n/a', 'tba', 'tbd',
  'faq', 'faqs',
  
  // 2-Letter Words from Different Languages & Spelling Variations
  // English & Scrabble-Valid 2-Letter Words
  'aa', 'ab', 'ae', 'ag', 'ah', 'ai', 'al', 'an', 'ar', 'as', 'at', 'aw', 'ax', 'ay',
  'be', 'bi', 'bo', 'by',
  'da', 'de', 'di', 'do',
  'eh', 'el', 'em', 'en', 'er', 'es', 'et', 'ex',
  'fa', 'fe', 'fi', 'fo',
  'ga', 'ge', 'gi', 'go', 'gu',
  'ha', 'he', 'hi', 'ho', 'hu',
  'if', 'in', 'is', 'it',
  'ja', 'je', 'jo',
  'ka', 'ke', 'ki', 'ko', 'ku',
  'la', 'le', 'li', 'lo',
  'ma', 'me', 'mi', 'mo', 'mu',
  'na', 'ne', 'no', 'nu',
  'od', 'oe', 'of', 'oh', 'om', 'on', 'op', 'or', 'os', 'ow', 'ox', 'oy',
  'pa', 'pe', 'pi', 'po', 'pu',
  'qi', 'qat', 'qoph', 'qadi', 'qaid',
  're', 'ri', 'ro',
  'sa', 'se', 'sh', 'si', 'so', 'su',
  'ta', 'te', 'ti', 'to',
  'uh', 'um', 'un', 'up', 'ur', 'us', 'ut',
  'we', 'wo',
  'xi', 'xu',
  'ya', 'ye', 'yo', 'yu',
  'za', 'ze', 'zi', 'zo',
  
  // Spanish/Latin Variants
  'el', 'la', 'le', 'lo', 'mi', 'mis', 'mo', 'nos', 'o', 'os', 'se', 'si', 'su', 'sus', 'te', 'ti', 'to', 'tu', 'tus', 'un', 'una', 'unas', 'uno', 'unos',
  'va', 've', 'vos', 'y', 'ya', 'yo',
  
  // French Variants
  'au', 'aux', 'ce', 'cet', 'cette', 'chez', 'de', 'des', 'du', 'et', 'eu', 'eux', 'he', 'hm', 'ho', 'hu', 'in', 'is', 'ja', 'je', 'la',
  'le', 'lequel', 'les', 'lesquels', 'lesquelles', 'leur', 'leurs', 'lui', 'ma', 'me', 'meme', 'mes', 'mien', 'mienne', 'miens', 'miennes',
  'min', 'mo', 'moi', 'mon', 'nos', 'notre', 'nôtre', 'nous', 'nu', 'o', 'oh', 'on', 'ont', 'os', 'ou', 'oui', 'où',
  'par', 'pas', 'per', 'peut', 'peuvent', 'peux', 'plus', 'plusieurs', 'pour', 'pourquoi', 'qu', 'qua', 'quand', 'quant',
  'que', 'quel', 'quelconque', 'quelle', 'quelles', 'quels', 'quelques',
  
  // Japanese Variants
  'ao', 'fu', 'ge', 'ju',
  
  // Chinese (Pinyin) Variants - Common 2-letter combinations
  'ba', 'chi', 'dao', 'de', 'fa', 'gong', 'gu', 'ha', 'he', 'hu', 'ji', 'jia', 'jing', 'jiu', 'ju', 'ka',
  'ke', 'kong', 'la', 'lai', 'le', 'lei', 'li', 'lian', 'liao', 'lie', 'lin', 'ling', 'liu', 'lo', 'long', 'lu',
  'lü', 'lv', 'ma', 'mai', 'man', 'mang', 'mao', 'me', 'mei', 'men', 'meng', 'mi', 'mian', 'miao', 'mie',
  'min', 'ming', 'miu', 'mo', 'mou', 'mu', 'na', 'nai', 'nan', 'nang', 'nao', 'ne', 'nei', 'nen', 'neng', 'ni', 'nian', 'niang',
  'niao', 'nie', 'nin', 'ning', 'niu', 'nong', 'nu', 'nü', 'nuan', 'nuo', 'nv', 'pa', 'pai', 'pan', 'pang', 'pao', 'pe', 'pei',
  'pen', 'peng', 'pi', 'pian', 'piao', 'pie', 'pin', 'ping', 'po', 'pou', 'pu',
  'qia', 'qian', 'qiang', 'qiao', 'qie', 'qin', 'qing', 'qiong', 'qiu', 'qu', 'quan', 'que', 'qun', 'ra', 'ran', 'rang', 'rao', 're', 'ren', 'reng', 'ri', 'rou', 'ru', 'ruan', 'rui', 'run', 'ruo',
  'sa', 'sai', 'san', 'sang', 'sao', 'se', 'sei', 'sen', 'seng', 'sha', 'shai', 'shan', 'shang', 'shao', 'she', 'shei', 'shen', 'sheng', 'shi', 'shou', 'shu', 'shua', 'shuai', 'shuan', 'shuang', 'shui', 'shun', 'shuo', 'si', 'so', 'sou', 'su', 'suan', 'sui', 'sun', 'suo',
  'tai', 'tan', 'tang', 'tao', 'te', 'tei', 'ten', 'teng', 'ti', 'tian', 'tiao', 'tie', 'tin', 'ting', 'to', 'tou', 'tu', 'tuan', 'tui', 'tun', 'tuo', 'wa', 'wai', 'wan', 'wang', 'wei', 'wen', 'weng', 'wo', 'wu',
  
  // Korean Hangul Variants (common syllables)
  'ga', 'gae', 'gi', 'gu', 'gul', 'gun', 'gung', 'guo',
  'ja', 'je', 'jo', 'ju', 'jul', 'jun', 'jung', 'juo',
  
  // Original Set (keeping all from before)
  'ad', 'am', 'atm', 'av', 'ba', 'bc', 'bce', 'blt', 'bs', 'btw', 'ce', 'ceo', 'cfo', 'cia', 'co', 'cpu',
  'csi', 'diy', 'dna', 'dvd', 'eta', 'eq', 'faq', 'fbi', 'fm', 'gif', 'gps', 'gpu', 'html', 'http', 'https',
  'id', 'im', 'imo', 'io', 'iq', 'irs', 'jpeg', 'jpg', 'laser', 'lcd', 'led', 'lol', 'mba', 'md',
  'mp', 'mph', 'mr', 'mrs', 'ms', 'nasa', 'nba', 'nfl', 'nhl', 'ok', 'pc', 'pdf', 'ph', 'pin',
  'pm', 'png', 'pr', 'radar', 'ram', 'rna', 'rom', 'rpg', 'rsvp', 'scuba', 'sim', 'sms', 'sos',
  'sql', 'tv', 'ufo', 'ui', 'uk', 'un', 'url', 'usa', 'usb', 'ux', 'vip', 'vr', 'wifi', 'www',
  'xml',
])

let dictionary: Set<string> | null = null

export function isDictionaryWord(word: string): boolean {
  return getDictionary().has(word)
}

export function isCommonAbbreviation(word: string): boolean {
  return COMMON_ABBREVIATIONS.has(word)
}

function getDictionary(): Set<string> {
  if (!dictionary) {
    const words = fs.readFileSync(WORD_LIST_PATH, 'utf8')
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z]+$/.test(word))
    dictionary = new Set(words)
  }
  return dictionary
}
