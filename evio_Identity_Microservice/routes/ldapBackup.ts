import ldap from 'ldapjs';
import fs from 'fs';
import { Request, Response } from 'express';

const LDAP_URL: string = process.env.LDAP_HOST || '';
const LDAP_BASE_DN: string = process.env.ldap_domain || '';
const LDAP_BIND_DN: string = process.env.ldap_admin_user || '';
const LDAP_BIND_PASSWORD: string = process.env.ldap_admin_password || '';

export default async (_req: Request, res: Response) => {
    const date = new Date();
    // Temporary path
    const ldifOutput = `/usr/src/app/img/groupCSUsers/ldap/ldap_${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}_${date.getHours()}h.ldif`;

    const client = ldap.createClient({ url: LDAP_URL });

    await new Promise<void>((resolve, reject) => {
        client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD, (err) => {
            if (err) return reject(new Error(`Erro ao autenticar no LDAP: ${err.message}`));
            return resolve();
        });
    });

    console.log('Autenticado no LDAP com sucesso.');

    const searchOptions: ldap.SearchOptions = {
        scope: 'sub',
        filter: '(objectClass=*)',
    };

    let ldifContent = '';

    await new Promise<void>((resolve, reject) => {
        client.search(LDAP_BASE_DN, searchOptions, (err, res) => {
            if (err) return reject(new Error(`Erro na busca LDAP: ${err.message}`));

            res.on('searchEntry', (entry) => {
                const dn = entry.dn.toString();
                const attributes = entry.attributes
                    .map((attr) => attr.vals
                        .map((val) => `${attr.type}:${attr.type === 'userPassword' ? `: ${btoa(val)}` : ` ${val}`}`)
                        .join('\n'))
                    .join('\n');

                ldifContent += `dn: ${dn}\n${attributes}\n\n`;
            });

            res.on('end', () => resolve());
            res.on('error', (searchErr) => reject(new Error(`Erro ao processar busca LDAP: ${searchErr.message}`)));
        });
    });

    fs.writeFileSync(ldifOutput, ldifContent);
    console.log(`Backup completo do LDAP salvo em ${ldifOutput}.`);

    client.unbind();
    return res.send(`Backup completo do LDAP salvo em ${ldifOutput}.`);
};
