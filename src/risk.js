const RISK_PATTERNS = [
  { key: 'prompt_injection', re: /(ignore (all )?(previous|prior) instructions|system prompt|developer message|do not follow|override|jailbreak)/i },
  { key: 'credential_exfil', re: /(api[_-]?key|token|password|secret|private key|seed phrase|mnemonic|ssh key|oauth)/i },
  { key: 'remote_exec', re: /(run this command|powershell|cmd\.exe|bash|curl .*\|\s*sh|download and execute|install this)/i },
  { key: 'suspicious_link', re: /(bit\.ly|tinyurl\.com|goo\.gl|t\.co\/\w{6,}|drive\.google\.com\/uc\?)/i },
];

function detectRiskFlags(text) {
  const t = (text || '').slice(0, 20000);
  const flags = [];
  for (const p of RISK_PATTERNS) {
    if (p.re.test(t)) flags.push(p.key);
  }
  return [...new Set(flags)];
}

module.exports = { detectRiskFlags };
