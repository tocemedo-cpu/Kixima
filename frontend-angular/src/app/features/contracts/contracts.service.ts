// Porta de contractRoutes.js/contractController.js — só a leitura (listMine),
// usada por Contracts.jsx (Company Admin). create/consolidate-billing ainda
// não têm ecrã Angular a chamá-los.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ContractDto, CreateContractBody } from '../../core/models/contract.model';

@Injectable({ providedIn: 'root' })
export class ContractsService {
  constructor(private readonly api: ApiService) {}

  // GET /api/contracts — o servidor decide o âmbito (todos para ADMIN_SISTEMA,
  // só os da própria empresa para os restantes) — ver contractController.listMine.
  list(): Observable<ContractDto[]> {
    return this.api.get<ContractDto[]>('/api/contracts');
  }

  // POST /api/contracts — ADMIN_SISTEMA ou COMPANY_ADMIN (só em nome da
  // própria empresa, 403 caso contrário — imposto pelo servidor).
  // clientCompany/supplierCompany vêm omitidos na resposta (diferente da
  // listagem, que os inclui).
  create(body: CreateContractBody): Observable<ContractDto> {
    return this.api.post<ContractDto>('/api/contracts', body);
  }
}
