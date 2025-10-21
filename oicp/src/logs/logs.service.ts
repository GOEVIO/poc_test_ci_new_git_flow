import { Injectable, Logger, Scope } from '@nestjs/common'

@Injectable({ scope: Scope.TRANSIENT })
export class LogsService extends Logger {
  constructor() {
    super() // Inicializa a classe Logger
  }

  // Método para definir o contexto dinamicamente
  setContext(context: string) {
    this.context = context
  }
}
