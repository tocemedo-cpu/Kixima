// Requer: npm install dotenv
require('dotenv').config();

const AGT_CONFIG = {
    environment: process.env.AGT_ENV || 'hml',
    nif: process.env.AGT_NIF,
    username: process.env.AGT_USERNAME,
    password: process.env.AGT_PASSWORD,
    companyName: process.env.AGT_COMPANY_NAME,

    software: {
        productId: process.env.AGT_PRODUCT_ID,
        version: process.env.AGT_SOFTWARE_VERSION,
        validationNumber: process.env.AGT_VALIDATION_NUMBER,
    },

    // environment: process.env.AGT_ENVIRONMENT || 'sandbox',

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
