package ao.kixima.supplierdev.dto;

/** Espelha supplierDevSchema (utils/schemas.js). */
public record CreateSupplierDevRequest(String companyName, String taxId, String contactName, String contactEmail,
                                        String contactPhone, String province, String sector, Integer employees,
                                        String track, String needs, Boolean feeAccepted) {
}
