const fs = require('fs');
const content = fs.readFileSync('app/admin/maintenance/page.tsx', 'utf8');

const t2 = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Diário */}`;

const i1 = content.indexOf(t2);
if (i1 === -1) { console.log('not found t2'); process.exit(1); }

const replacedContent = content.replace(t2, `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                        {/* Diário */}`);

const t3 = `</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', marginBottom: '20px' }}>
                        {/* Radar de Mercado */}`;

const replacedContent2 = replacedContent.replace(t3, `</div>
                        {/* Radar de Mercado */}`);

fs.writeFileSync('app/admin/maintenance/page.tsx', replacedContent2);
console.log('done replacing layout');
