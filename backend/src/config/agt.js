// src/config/agt.js
// URLs dos endpoints da Sandbox/homologação e de produção da AGT — a ÚNICA
// coisa que este ficheiro resolve. As credenciais (utilizador/senha da
// Sandbox, chave privada JWS, número de validação do software) NÃO vivem
// aqui: continuam a vir de config/env.js (config.agt.*), que já as lê das
// variáveis AGT_SANDBOX_USERNAME/AGT_SANDBOX_PASSWORD/
// AGT_JWS_PRIVATE_KEY_BASE64/AGT_SOFTWARE_VALIDATION_NUMBER/AGT_SOFTWARE_ID/
// AGT_SOFTWARE_VERSION — uma só fonte para não haver duas leituras
// divergentes da mesma chave. Este ficheiro chegou a ter campos próprios
// (nif, username, password, companyName, software.*) que duplicavam essas
// leituras com nomes de variável diferentes (ex.: AGT_USERNAME em vez de
// AGT_SANDBOX_USERNAME) — nenhum deles chegou a ser lido por código nenhum,
// por isso foram removidos.
const AGT_CONFIG = {
    environment: process.env.AGT_ENV || 'hml',

    endpoints: {
        hml: {
            registarFactura: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura',
            consultarFactura: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/consultarFactura',
            obterEstado: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/obterEstado',
            solicitarSerie: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/solicitarSerie',
            listarSeries: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/listarSeries',
            listarFacturas: 'https://sifphml.minfin.gov.ao/sigt/fe/v1/listarFacturas',
        },
        prd: {
            registarFactura: 'https://sifp.minfin.gov.ao/sigt/fe/v1/registarFactura',
            consultarFactura: 'https://sifp.minfin.gov.ao/sigt/fe/v1/consultarFactura',
            obterEstado: 'https://sifp.minfin.gov.ao/sigt/fe/v1/obterEstado',
            solicitarSerie: 'https://sifp.minfin.gov.ao/sigt/fe/v1/solicitarSerie',
            listarSeries: 'https://sifp.minfin.gov.ao/sigt/fe/v1/listarSeries',
            listarFacturas: 'https://sifp.minfin.gov.ao/sigt/fe/v1/listarFacturas',
        },
    },
};

/**
 * Devolve o URL do endpoint indicado, de acordo com o ambiente atual (hml/prd).
 * @param {string} name - nome do endpoint (ex: 'registarFactura')
 * @returns {string}
 */
function getEndpoint(name) {
    const env = AGT_CONFIG.environment;
    return AGT_CONFIG.endpoints[env][name];
}

module.exports = { AGT_CONFIG, getEndpoint };
