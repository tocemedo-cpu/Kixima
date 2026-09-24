package ao.kixima.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Teste de paridade de contrato (plano, secção 4) para o troço de leitura de
 * catalogController.js/catalogRoutes.js, contra os produtos já semeados na
 * mesma base de teste local do Node. `@Transactional` garante que o
 * incrementView (best-effort) não deixa marca depois do teste.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CatalogControllerTest {

    private static final String EMAIL = "comprador@petroangola.co.ao";
    private static final String PASSWORD = "Kixima@123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String login() throws Exception {
        var res = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", EMAIL, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void listarCatalogoExigeSessao() throws Exception {
        mockMvc.perform(get("/api/catalog"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listarCatalogoAutenticadoDevolveProdutosComFornecedor() throws Exception {
        String token = login();
        mockMvc.perform(get("/api/catalog").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].id").isString())
                .andExpect(jsonPath("$[0].supplier.id").isString())
                .andExpect(jsonPath("$[0].images").doesNotExist()); // listCatalog não inclui media, tal como o Node.
    }

    @Test
    void obterProdutoPorSlugIncluiImagensEDocumentosEFornecedorReduzido() throws Exception {
        String token = login();
        var slugRes = mockMvc.perform(get("/api/catalog").header("Authorization", "Bearer " + token))
                .andReturn();
        String slug = objectMapper.readTree(slugRes.getResponse().getContentAsString()).get(0).get("slug").asText();

        mockMvc.perform(get("/api/catalog/slug/" + slug).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug))
                .andExpect(jsonPath("$.images").isArray())
                .andExpect(jsonPath("$.documents").isArray())
                .andExpect(jsonPath("$.supplier.id").isString())
                .andExpect(jsonPath("$.supplier.city").doesNotExist()); // getProductBySlug não inclui city, só getBySlug de listCatalog inclui.
    }

    @Test
    void produtoInexistenteDevolve404ComEnvelopeDoNode() throws Exception {
        String token = login();
        mockMvc.perform(get("/api/catalog/id-que-nao-existe-de-todo").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Produto não encontrado."));
    }

    @Test
    void documentacaoDoFornecedorListaDocumentosDeCredenciamentoESoParaFornecedorOuCompanyAdmin() throws Exception {
        String compradorToken = login();
        mockMvc.perform(get("/api/catalog/documents").header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isForbidden());

        var res = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", "fornecedor@kianda.co.ao", "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        String fornecedorToken = objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/catalog/documents").header("Authorization", "Bearer " + fornecedorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productDocs").isArray())
                .andExpect(jsonPath("$.companyDocs").isArray())
                .andExpect(jsonPath("$.companyDocs.length()").value(2))
                .andExpect(jsonPath("$.companyDocs[?(@.type=='CERTIDAO_COMERCIAL')].originalName").value("certidao-kianda.pdf"))
                .andExpect(jsonPath("$.companyDocs[?(@.type=='LICENCA_ANPG')]").exists());
    }
}
