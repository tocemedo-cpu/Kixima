// Espelha CompanyService.BankDetailsDto (Java) — dados bancários do
// fornecedor, usados nas faturas geradas pela plataforma.
export interface BankDetails {
  bankName?: string | null;
  iban?: string | null;
  swift?: string | null;
}
