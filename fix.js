const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    const ext = path.extname(filePath);
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');

    const replacements = {
        'MÃƒÂ©dio': 'Médio',
        'trÃƒÂ¡fego': 'tráfego',
        'ImpressÃƒÂµes': 'Impressões',
        'DistribuiÃƒÂ§ÃƒÂ£o': 'Distribuição',
        'ConversÃƒÂµes': 'Conversões',
        'TermÃƒÂ´metro': 'Termômetro',
        'HistÃƒÂ³rico': 'Histórico',
        'AnÃƒÂ¡lides': 'Análises',
        'AnÃƒÂ¡lises': 'Análises',
        'MÃƒÂªs': 'Mês',
        'ÃƒÅ¡ltimos': 'Últimos',
        'VitalÃƒÂ­cio': 'Vitalício',
        'atÃƒÂ©': 'até',
        'DiagnÃƒÂ³stico': 'Diagnóstico',
        'CrÃƒÂ­tico': 'Crítico',
        'CrÃƒÂ­tica': 'Crítica',
        'comeÃƒÂ§ar': 'começar',
        'anÃƒÂ¡lise': 'análise',
        'AnÃƒÂ¡lise': 'Análise',
        'RACIOCÃƒÂ NIO': 'RACIOCÍNIO',
        'ConfiguraÃƒÂ§ÃƒÂµes': 'Configurações',
        'OpÃƒÂ§ÃƒÂµes': 'Opções',
        'AtualizaÃƒÂ§ÃƒÂ£o': 'Atualização',
        'Ã°Å¸Â§Â ': '🧠',
        'Ã¢Å“â€¦': '✅',
        'Ã°Å¸Å¸Â¢': '🟢',
        'Ã°Å¸â€ Âµ': '🔵',
        'Ã°Å¸Å¸Â¡': '🟡',
        'Ã°Å¸Å¸Â ': '🟠',
        'Ã°Å¸â€ Â´': '🔴',
        'Ã°Å¸â€™Â°': '💰',
        'Ã°Å¸â€œÅ ': '📊',
        'Ã°Å¸â€œâ€¹': '📋',
        'Ã°Å¸Â¤â€“': '🤖',
        'Ã¢â€ºâ€ ': '🛑',
        'Ã°Å¸â€œË†': '📈',
        'Ã°Å¸â€œâ€°': '📉',
        'Ã°Å¸â€ â€ž': '🔁',
        'Ã¢Å¡Â¡': '⚡',
        'Ã¢Å¡Â Ã¯Â¸Â ': '⚠️',
        'Ã°Å¸â€™Â¡': '💡',
        'Ã¢Ëœâ€¦': '★',
        'Ã¢â€“Â¼': '▼',
        'Ã¢â€“Â ': '■',
        'Ã°Å¸Â Â ': '🏠',
        'Ã¢â‚¬Â¢': '•',
        'Ã¢â‚¬â€ ': '—',
        'mÃƒÂ©tricas': 'métricas',
        'anÃƒÂ¡lise': 'análise',
        'AvanÃƒÂ§adas': 'Avançadas',
        'NÃƒÂ£o': 'Não',
        'padrÃƒÂ£o': 'padrão',
        'Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬': '---',
        'Ã¢â€ â‚¬Ã¢â€ â‚¬': '--',
        'Ã¢â€ â‚¬': '-',
        'Ã°Å¸Å½Â¯': '🎯',
        'Ã°Å¸â€œÅ“': '📜',
        'Ã°Å¸â€™Â¡': '💡',
        'OrÃƒÂ§amento': 'Orçamento',
        'DiÃƒÂ¡rio': 'Diário',
        'InÃƒÂ­cio': 'Início',
        'TÃƒÂ©rmino': 'Término',
        'ConcluÃƒÂ­da': 'Concluída',
        'PadrÃƒÂ£o': 'Padrão',
        'AplicaÃƒÂ§ÃƒÂ£o': 'Aplicação',
        'GestÃƒÂ£o': 'Gestão',
        'CorretorÃƒÂªs': 'Corretores',
        'VocÃƒÂª': 'Você',
        'MÃƒÂ³vel': 'Móvel',
        'TrÃƒÂ¡fego': 'Tráfego',
        'AutomÃƒÂ¡tico': 'Automático',
        'sincronizaÃƒÂ§ÃƒÂ£o': 'sincronização',
    };

    let newContent2 = content;
    let changed = false;
    for (const bad in replacements) {
        if (newContent2.includes(bad)) {
            newContent2 = newContent2.split(bad).join(replacements[bad]);
            changed = true;
        }
    }

    // Additional targeted mojibake fixes for isolated chars
    const chars = {
        'ÃƒÂ¡': 'á',
        'ÃƒÂ¢': 'â',
        'ÃƒÂ£': 'ã',
        'ÃƒÂ©': 'é',
        'ÃƒÂª': 'ê',
        'ÃƒÂ­': 'í',
        'ÃƒÂ³': 'ó',
        'ÃƒÂ´': 'ô',
        'ÃƒÂµ': 'õ',
        'ÃƒÂº': 'ú',
        'ÃƒÂ§': 'ç',
        'ÃƒÂ ': 'à',
        'ÃƒÂ ': 'Á', // A with acute? 
        'Ãƒâ€°': 'É',
        'ÃƒÂŠ': 'Ê',
        'ÃƒÂ': 'Í',
        'Ãƒâ€œ': 'Ó',
        'Ãƒâ€': 'Ô',
        'Ãƒâ€¢': 'Õ',
        'ÃƒÅ¡': 'Ú',
        'Ãƒâ€¡': 'Ç',
        'Ãƒâ‚¬': 'À'
    }
    
    for (const bad in chars) {
        if (newContent2.includes(bad)) {
            newContent2 = newContent2.split(bad).join(chars[bad]);
            changed = true;
        }
    }

    if (changed && newContent2 !== content) {
        fs.writeFileSync(filePath, newContent2, 'utf8');
        console.log('Fixed', filePath);
    }
}

function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

traverse(path.join(process.cwd(), 'app'));
traverse(path.join(process.cwd(), 'components'));
traverse(path.join(process.cwd(), 'lib'));
traverse(path.join(process.cwd(), 'studio_import'));
console.log('Done');
