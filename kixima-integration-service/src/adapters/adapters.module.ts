import { Module } from '@nestjs/common';
import { SapAdapter } from './sap.adapter';
import { PrimaveraAdapter } from './primavera.adapter';
import { OracleAdapter } from './oracle.adapter';
import { AribaAdapter } from './ariba.adapter';
import { AdapterRegistry } from './adapter.registry';

@Module({
  providers: [SapAdapter, PrimaveraAdapter, OracleAdapter, AribaAdapter, AdapterRegistry],
  exports: [AdapterRegistry],
})
export class AdaptersModule {}
