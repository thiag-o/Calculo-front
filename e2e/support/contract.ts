// Simulated API responses, taken from the backend contract (../backend/contracts/openapi.yaml).
//
// The front CI does not have the backend repository next to it, so the examples are copied here, typed by the
// schemas generated from the contract (ADR 0005). The `contract-examples.spec.ts` test compares this copy with the
// contract's `components.examples` whenever it is next to it (development machine): if they diverge, it fails.
import type { components } from '../../packages/react/src/api/generated/schema';

export type Schemas = components['schemas'];
export type Session = Schemas['Session'];
export type Problem = Schemas['Problem'];
/** A contract error body: the `Problem` or one of the flat schemas with their own members. */
export type ErrorBody = Problem | Schemas['LoginLockedProblem'] | Schemas['InvalidDataProblem'];

/** Literal copy of the contract's `components.examples` (example name → `value`). */
export const EXAMPLES = {
  NoSession: {
    type: 'about:blank',
    title: 'Sem sessão',
    status: 401,
    detail: 'Sua sessão expirou. Entre novamente.',
    code: 'no_session',
  },
  InvalidCsrf: {
    type: 'about:blank',
    title: 'Requisição recusada',
    status: 403,
    detail: 'Não foi possível confirmar a origem da requisição. Recarregue a página e tente de novo.',
    code: 'invalid_csrf',
  },
  NoTenantAccess: {
    type: 'about:blank',
    title: 'Sem acesso ao tenant',
    status: 403,
    detail: 'Você não tem acesso a esta empresa.',
    code: 'no_tenant_access',
  },
  InvalidCredentials: {
    type: 'about:blank',
    title: 'Credenciais inválidas',
    status: 401,
    detail: 'E-mail ou senha incorretos.',
    code: 'invalid_credentials',
  },
  LoginLocked: {
    type: 'about:blank',
    title: 'Login bloqueado',
    status: 423,
    detail: 'Muitas tentativas erradas. Tente de novo mais tarde.',
    code: 'login_locked',
    unlocks_at: '2026-11-15T14:30:00Z',
  } satisfies Schemas['LoginLockedProblem'],
  InvalidData: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { tenant_id: 'Informe um identificador válido.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataMalformedJson: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { body: 'Não foi possível ler os dados enviados.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidContentType: {
    type: 'about:blank',
    title: 'Tipo de conteúdo inválido',
    status: 415,
    detail: 'Não foi possível processar a requisição. Recarregue a página e tente de novo.',
    code: 'invalid_content_type',
  },
  TooManyAttempts: {
    type: 'about:blank',
    title: 'Muitas tentativas',
    status: 429,
    detail: 'Muitas tentativas de login a partir deste endereço. Aguarde um minuto e tente de novo.',
    code: 'too_many_attempts',
  },
  // Epic 2 (B13 onwards).
  NoPermission: {
    type: 'about:blank',
    title: 'Sem permissão',
    status: 403,
    detail: 'Você não tem permissão para esta ação.',
    code: 'no_permission',
  },
  OriginNotAuthorized: {
    type: 'about:blank',
    title: 'Origem não autorizada',
    status: 403,
    detail: 'Este endereço não está autorizado a usar o módulo. Fale com o administrador.',
    code: 'origin_not_authorized',
  },
  NotFound: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'O item procurado não existe ou foi removido.',
    code: 'not_found',
  },
  InvalidDataId: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { id: 'Informe um identificador válido.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataLimit: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { limit: 'Informe um número de 1 a 200.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataNewPassword: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { new_password: 'Campo obrigatório.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataToken: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { token: 'Campo obrigatório.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataOrigin: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { origin: 'Campo obrigatório.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataSecurity: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: { min_password_length: 'Informe um número inteiro.' },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidCursor: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'O cursor de paginação é inválido. Recarregue a lista do início.',
    code: 'invalid_cursor',
  },
  InvalidEventType: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'O tipo do evento de acesso não é válido.',
    code: 'invalid_event_type',
    fields: { type: "Tipo desconhecido: 'login'." },
  },
  FixedRole: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'O papel Admin não pode ser alterado nem removido.',
    code: 'fixed_role',
  },
  RoleInUse: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'O papel está atribuído a usuários. Tire o papel deles antes de remover.',
    code: 'role_in_use',
  },
  RoleAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe um papel com esse nome.',
    code: 'role_already_exists',
  },
  UserAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este e-mail já é de um usuário desta empresa.',
    code: 'user_already_exists',
  },
  LastAdmin: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'A empresa precisa de ao menos um Admin ativo.',
    code: 'last_admin',
  },
  InactiveUser: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'O usuário está inativo. Ative-o antes de gerar o link.',
    code: 'inactive_user',
  },
  ExternalUser: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este usuário entra pelo sistema integrado e não tem senha.',
    code: 'external_user',
  },
  InvalidLink: {
    type: 'about:blank',
    title: 'Não está mais disponível',
    status: 410,
    detail: 'Este link não vale mais. Peça um novo link ao administrador.',
    code: 'invalid_link',
  },
  InvalidPassword: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A senha não cumpre a política de senha.',
    code: 'invalid_password',
    fields: { new_password: 'A senha precisa ter pelo menos 12 caracteres.' },
  },
  InvalidApiKey: {
    type: 'about:blank',
    title: 'Não autenticado',
    status: 401,
    detail: 'Chave de API inválida ou revogada.',
    code: 'invalid_api_key',
  },
  EmailInUse: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este e-mail já pertence a outro usuário.',
    code: 'email_in_use',
  },
  InactiveEmbedUser: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este usuário está desativado nesta empresa.',
    code: 'inactive_user',
  },
  RoleNotAllowed: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A incorporação não pode dar nem tirar o papel Admin.',
    code: 'role_not_allowed',
    fields: { roles: 'O papel Admin não pode ser informado pela incorporação.' },
  },
  UnknownRole: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Um dos papéis informados não existe nesta empresa.',
    code: 'unknown_role',
  },
  AuthorizedDomainAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este domínio já está cadastrado.',
    code: 'authorized_domain_already_exists',
  },
  InvalidOrigin: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Informe a origem no formato https://endereco ou http://endereco:porta.',
    code: 'invalid_origin',
    fields: { origin: 'Use o formato https://host[:porta], sem caminho.' },
  },
  ValueOutOfRange: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns valores estão fora dos limites aceitos.',
    code: 'value_out_of_range',
    fields: {
      inactivity_minutes: 'Informe um valor de 15 a 1440.',
      min_password_length: 'Informe um valor de 8 a 64.',
    },
  },
  ConnectionFailed: {
    type: 'about:blank',
    title: 'Falha na conexão',
    status: 422,
    detail: 'O banco não respondeu a tempo.',
    code: 'connection_failed'
  },
  ConnectionNotReadOnly: {
    type: 'about:blank',
    title: 'Usuário não é somente leitura',
    status: 422,
    detail: 'O usuário do banco pode alterar dados. Use um usuário só de leitura.',
    code: 'connection_not_read_only',
    privileges: [
      'INSERT em public.notas_fiscais',
      'CREATE no banco'
    ]
  },
  ConnectionWithoutTls: {
    type: 'about:blank',
    title: 'Conexão sem TLS',
    status: 422,
    detail: 'O banco não aceitou uma conexão com TLS, que é obrigatória.',
    code: 'connection_without_tls'
  },
  TargetNotAllowed: {
    type: 'about:blank',
    title: 'Destino não permitido',
    status: 422,
    detail: 'Este endereço de banco não é permitido.',
    code: 'connection_target_not_allowed'
  },
  ConnectionRefused: {
    type: 'about:blank',
    title: 'Falha na conexão',
    status: 422,
    detail: 'O banco recusou a conexão.',
    code: 'connection_failed'
  },
  HostNotFound: {
    type: 'about:blank',
    title: 'Falha na conexão',
    status: 422,
    detail: 'O endereço do banco não foi encontrado.',
    code: 'connection_failed'
  },
  AuthenticationFailed: {
    type: 'about:blank',
    title: 'Falha na conexão',
    status: 422,
    detail: 'O banco recusou o usuário ou a senha.',
    code: 'connection_failed'
  },
  InvalidSqlRejectedByDatabase: {
    type: 'about:blank',
    title: 'SQL inválido',
    status: 422,
    detail: 'O SQL não pode ser usado num dataset.',
    code: 'invalid_sql',
    fields: {
      sql: 'O banco recusou o SQL ao ler as colunas.'
    }
  },
  ConnectionAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe uma conexão com esse nome.',
    code: 'connection_already_exists'
  },
  ConnectionChanged: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'A conexão foi alterada por outra ação enquanto esta acontecia. Confira e tente de novo.',
    code: 'connection_changed'
  },
  ConnectionCredentialUnreadable: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'A credencial desta conexão não pôde ser lida. Cadastre a credencial de novo.',
    code: 'connection_credential_unreadable'
  },
  ConnectionInUse: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'A conexão é usada por datasets. Remova-os antes de remover a conexão.',
    code: 'connection_in_use'
  },
  FileTooLarge: {
    type: 'about:blank',
    title: 'Arquivo grande demais',
    status: 413,
    detail: 'O arquivo passa do limite de 20 MB.',
    code: 'file_too_large'
  },
  InvalidFile: {
    type: 'about:blank',
    title: 'Arquivo inválido',
    status: 422,
    detail: 'O arquivo não é uma planilha .xlsx que possa ser lida.',
    code: 'invalid_file'
  },
  InvalidHeader: {
    type: 'about:blank',
    title: 'Cabeçalho inválido',
    status: 422,
    detail: 'A primeira linha de cada aba precisa ter um nome único em cada coluna.',
    code: 'invalid_header',
    fields: {
      'Vendas!C1': 'Coluna sem nome.',
      'Vendas!E1': "Nome repetido: 'valor'."
    }
  },
  InvalidDataFile: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      file: 'Campo obrigatório.'
    }
  },
  ExcelFileInUse: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'O arquivo é usado por datasets. Remova-os antes de remover o arquivo.',
    code: 'excel_file_in_use'
  },
  InvalidDataConnectionId: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      connection_id: 'Informe um identificador válido.'
    }
  },
  InvalidDataUnknownConnection: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      connection_id: 'Conexão não encontrada.'
    }
  },
  InvalidSql: {
    type: 'about:blank',
    title: 'SQL inválido',
    status: 422,
    detail: 'O SQL não pode ser usado num dataset.',
    code: 'invalid_sql',
    fields: {
      sql: 'Só é aceito um comando SELECT.'
    }
  },
  UnknownObject: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A tabela ou view não existe no banco da conexão.',
    code: 'unknown_object',
    fields: {
      object_name: "Não existe 'public.vendas'."
    }
  },
  UnknownSheet: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A aba não existe no arquivo.',
    code: 'unknown_sheet',
    fields: {
      sheet: "Não existe a aba 'Plan2'."
    }
  },
  DatasetAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe um dataset com esse nome.',
    code: 'dataset_already_exists'
  },
  VariableAlreadyExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe uma variável com esse nome neste dataset.',
    code: 'variable_already_exists'
  },
  UnknownColumn: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A coluna não está no dataset.',
    code: 'unknown_column',
    fields: {
      column: "Não existe a coluna 'vl_item'."
    }
  },
  IncompatibleType: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'A coluna não pode virar uma variável desse tipo.',
    code: 'incompatible_type',
    fields: {
      type: 'Uma coluna de texto não pode virar decimal.'
    }
  },
  InvalidVariableName: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'O nome da variável não é válido.',
    code: 'invalid_variable_name',
    fields: {
      name: 'Use letras minúsculas, números e _, começando por uma letra (até 63).'
    }
  },
  // Epic 4 (B56 onwards).
  InvalidDataFileName: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      file: 'O nome do arquivo pode ter até 255 caracteres.',
    },
  },
  DatasetChanged: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'O dataset foi alterado por outra ação enquanto esta acontecia. Confira e tente de novo.',
    code: 'dataset_changed',
  },
  VariableChanged: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'A variável foi alterada por outra ação enquanto esta acontecia. Confira e tente de novo.',
    code: 'variable_changed',
  },
  FormulaLanguage: {
    functions: [
      {
        name: 'ARRED',
        aliases: [],
        internal_name: 'round',
        signature: 'ARRED(x, casas)',
        description: 'Arredonda x com as casas (0 a 18), com o meio para longe do zero.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'TRUNCAR',
        aliases: [],
        internal_name: 'trunc',
        signature: 'TRUNCAR(x, casas)',
        description: 'Corta x nas casas (0 a 18), em direção ao zero.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'ABS',
        aliases: [],
        internal_name: 'abs',
        signature: 'ABS(x)',
        description: 'Valor absoluto.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'MÍN',
        aliases: [
          'MIN',
        ],
        internal_name: 'min',
        signature: 'MÍN(a, b, …)',
        description: 'O menor de dois ou mais números.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'MÁX',
        aliases: [
          'MAX',
        ],
        internal_name: 'max',
        signature: 'MÁX(a, b, …)',
        description: 'O maior de dois ou mais números.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'MÍN',
        aliases: [
          'MIN',
        ],
        internal_name: 'min',
        signature: 'MÍN(lista[])',
        description: 'O menor valor da lista, ignorando os nulos.',
        kind: 'aggregation',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'MÁX',
        aliases: [
          'MAX',
        ],
        internal_name: 'max',
        signature: 'MÁX(lista[])',
        description: 'O maior valor da lista, ignorando os nulos.',
        kind: 'aggregation',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'SOMA',
        aliases: [],
        internal_name: 'sum',
        signature: 'SOMA(lista[])',
        description: 'A soma da lista, ignorando os nulos; lista vazia dá 0.',
        kind: 'aggregation',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'CONTAR',
        aliases: [],
        internal_name: 'count',
        signature: 'CONTAR(lista[])',
        description: 'Quantos itens (ou valores não nulos de um campo) a lista tem.',
        kind: 'aggregation',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'MÉDIA',
        aliases: [
          'MEDIA',
        ],
        internal_name: 'avg',
        signature: 'MÉDIA(lista[])',
        description: 'A média da lista, ignorando os nulos.',
        kind: 'aggregation',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
      {
        name: 'EXISTE',
        aliases: [],
        internal_name: 'exists',
        signature: 'EXISTE(lista[])',
        description: 'Verdadeiro se a lista tiver algum valor não nulo.',
        kind: 'aggregation',
        contexts: [
          'decision_condition',
        ],
      },
      {
        name: 'DATA',
        aliases: [],
        internal_name: 'date',
        signature: 'DATA(ano, mês, dia)',
        description: 'Uma data, a partir de três números inteiros.',
        kind: 'scalar',
        contexts: [
          'calculation',
          'decision_condition',
          'decision_result',
        ],
      },
    ],
    keywords: [
      'verdadeiro',
      'falso',
      'nulo',
      'e',
      'em',
      'entre',
    ],
    operators: [
      '+',
      '-',
      '*',
      '/',
      '^',
    ],
  },
  WorkflowList: {
    items: [
      {
        id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
        name: 'Pontuação de exemplo',
        objective: 'Calcula os pontos de cada item da nota na campanha.',
        kind: 'batch',
        updated_at: '2026-11-18T14:05:00Z',
        updated_by: {
          id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
          name: 'Bruno Lima',
        },
        draft: {
          revision: 3,
          updated_at: '2026-11-18T14:05:00Z',
          updated_by: {
            id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
            name: 'Bruno Lima',
          },
          node_count: 3,
          problem_count: 0,
        },
      },
      {
        id: '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b',
        name: 'Bônus de metas',
        objective: null,
        kind: 'batch',
        updated_at: '2026-11-17T09:12:00Z',
        updated_by: {
          id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
          name: 'Ana Souza',
        },
        draft: {
          revision: 7,
          updated_at: '2026-11-17T09:12:00Z',
          updated_by: {
            id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
            name: 'Ana Souza',
          },
          node_count: 5,
          problem_count: 2,
        },
      },
    ],
    next_cursor: null,
  },
  NewWorkflow: {
    name: 'Pontuação de exemplo',
  },
  WorkflowCreated: {
    id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
    name: 'Pontuação de exemplo',
    objective: null,
    kind: 'batch',
    updated_at: '2026-11-18T13:40:00Z',
    updated_by: {
      id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
      name: 'Ana Souza',
    },
    draft: {
      revision: 1,
      updated_at: '2026-11-18T13:40:00Z',
      updated_by: {
        id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
        name: 'Ana Souza',
      },
      node_count: 0,
      problem_count: 0,
    },
    created_at: '2026-11-18T13:40:00Z',
    created_by: {
      id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
      name: 'Ana Souza',
    },
  },
  Workflow: {
    id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
    name: 'Pontuação de exemplo',
    objective: 'Calcula os pontos de cada item da nota na campanha.',
    kind: 'batch',
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: {
      id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      name: 'Bruno Lima',
    },
    draft: {
      revision: 3,
      updated_at: '2026-11-18T14:05:00Z',
      updated_by: {
        id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        name: 'Bruno Lima',
      },
      node_count: 3,
      problem_count: 0,
    },
    created_at: '2026-11-18T13:40:00Z',
    created_by: {
      id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
      name: 'Ana Souza',
    },
  },
  Draft: {
    workflow_id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
    revision: 3,
    definition: {
      schema_version: 1,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
      },
      root: {
        inputs: [
          {
            name: 'valor_item',
            cardinality: 'linear',
            type: 'decimal',
            scale: 2,
          },
          {
            name: 'categoria',
            cardinality: 'linear',
            type: 'text',
          },
          {
            name: 'meta_atingida',
            cardinality: 'linear',
            type: 'boolean',
          },
          {
            name: 'pontuacoes',
            cardinality: 'multiple',
            fields: [
              {
                name: 'valor_compra',
                type: 'decimal',
                scale: 2,
              },
              {
                name: 'taxa',
                type: 'decimal',
                scale: 4,
              },
            ],
          },
        ],
        nodes: [
          {
            id: 'td_elegibilidade',
            type: 'decision_table',
            name: 'Elegibilidade',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            hit_policy: 'first',
            rounding_mode: null,
            error_policy: null,
            conditions: [
              {
                expression: 'categoria',
              },
              {
                expression: 'EXISTE(pontuacoes[])',
              },
              {
                expression: 'meta_atingida',
              },
            ],
            results: [
              {
                name: 'elegivel',
                type: 'boolean',
                default_value: null,
              },
              {
                name: 'fator',
                type: 'decimal',
                scale: 4,
                default_value: null,
              },
            ],
            rules: [
              {
                when: [
                  '-',
                  'verdadeiro',
                  '-',
                ],
                then: [
                  'falso',
                  '0',
                ],
              },
              {
                when: [
                  '"A"',
                  'falso',
                  'verdadeiro',
                ],
                then: [
                  'verdadeiro',
                  '0.15',
                ],
              },
              {
                when: [
                  '-',
                  'falso',
                  '-',
                ],
                then: [
                  'verdadeiro',
                  '0.10',
                ],
              },
            ],
          },
          {
            id: 'calc_historico',
            type: 'calculation',
            name: 'Pontos já ganhos',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            expression: 'SOMA(valor_compra[] * taxa[])',
            output: {
              name: 'pontos_historico',
              type: 'decimal',
              scale: 2,
            },
            rounding_mode: null,
            error_policy: null,
            default_value: null,
          },
          {
            id: 'calc_pontos',
            type: 'calculation',
            name: 'Pontos',
            description: null,
            position: {
              x: 480,
              y: 0,
            },
            expression: 'MÍN(ARRED(valor_item * fator, 2), 1000 - pontos_historico)',
            output: {
              name: 'pontos',
              type: 'decimal',
              scale: 2,
            },
            rounding_mode: null,
            error_policy: null,
            default_value: null,
          },
        ],
        output: {
          fields: [
            {
              name: 'pontos',
              variable: 'pontos',
            },
            {
              name: 'elegivel',
              variable: 'elegivel',
            },
          ],
        },
      },
    },
    problems: [],
    symbols: [
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ]
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ]
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ]
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: {
      id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      name: 'Bruno Lima',
    },
  },
  DraftEmpty: {
    workflow_id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
    revision: 1,
    definition: {
      schema_version: 1,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
      },
      root: {
        inputs: [],
        nodes: [],
        output: {
          fields: [],
        },
      },
    },
    problems: [],
    symbols: [],
    dependencies: [],
    order: [],
    updated_at: '2026-11-18T13:40:00Z',
    updated_by: {
      id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
      name: 'Ana Souza',
    },
  },
  DraftUpdate: {
    revision: 2,
    definition: {
      schema_version: 1,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
      },
      root: {
        inputs: [
          {
            name: 'valor_item',
            cardinality: 'linear',
            type: 'decimal',
            scale: 2,
          },
          {
            name: 'categoria',
            cardinality: 'linear',
            type: 'text',
          },
          {
            name: 'meta_atingida',
            cardinality: 'linear',
            type: 'boolean',
          },
          {
            name: 'pontuacoes',
            cardinality: 'multiple',
            fields: [
              {
                name: 'valor_compra',
                type: 'decimal',
                scale: 2,
              },
              {
                name: 'taxa',
                type: 'decimal',
                scale: 4,
              },
            ],
          },
        ],
        nodes: [
          {
            id: 'td_elegibilidade',
            type: 'decision_table',
            name: 'Elegibilidade',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            hit_policy: 'first',
            rounding_mode: null,
            error_policy: null,
            conditions: [
              {
                expression: 'categoria',
              },
              {
                expression: 'EXISTE(pontuacoes[])',
              },
              {
                expression: 'meta_atingida',
              },
            ],
            results: [
              {
                name: 'elegivel',
                type: 'boolean',
                default_value: null,
              },
              {
                name: 'fator',
                type: 'decimal',
                scale: 4,
                default_value: null,
              },
            ],
            rules: [
              {
                when: [
                  '-',
                  'verdadeiro',
                  '-',
                ],
                then: [
                  'falso',
                  '0',
                ],
              },
              {
                when: [
                  '"A"',
                  'falso',
                  'verdadeiro',
                ],
                then: [
                  'verdadeiro',
                  '0.15',
                ],
              },
              {
                when: [
                  '-',
                  'falso',
                  '-',
                ],
                then: [
                  'verdadeiro',
                  '0.10',
                ],
              },
            ],
          },
          {
            id: 'calc_historico',
            type: 'calculation',
            name: 'Pontos já ganhos',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            expression: 'SOMA(valor_compra[] * taxa[])',
            output: {
              name: 'pontos_historico',
              type: 'decimal',
              scale: 2,
            },
            rounding_mode: null,
            error_policy: null,
            default_value: null,
          },
          {
            id: 'calc_pontos',
            type: 'calculation',
            name: 'Pontos',
            description: null,
            position: {
              x: 480,
              y: 0,
            },
            expression: 'MÍN(ARRED(valor_item * fator, 2), 1000 - pontos_historico)',
            output: {
              name: 'pontos',
              type: 'decimal',
              scale: 2,
            },
            rounding_mode: null,
            error_policy: null,
            default_value: null,
          },
        ],
        output: {
          fields: [
            {
              name: 'pontos',
              variable: 'pontos',
            },
            {
              name: 'elegivel',
              variable: 'elegivel',
            },
          ],
        },
      },
    },
  },
  Analysis: {
    problems: [],
    symbols: [
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ]
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ]
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ]
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
  },
  AnalysisTypeMismatch: {
    problems: [
      {
        code: 'type_mismatch',
        message: 'Esperava um número, mas categoria é um texto.',
        path: 'root.nodes[2].expression',
        node_id: 'calc_pontos',
        start: 13,
        end: 22,
        suggestion: null,
      },
    ],
    symbols: [
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ]
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ]
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ]
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
  },
  AnalysisUnknownVariable: {
    problems: [
      {
        code: 'unknown_variable',
        message: 'valor_iten não existe neste ponto do fluxo. Você quis dizer valor_item?',
        path: 'root.nodes[2].expression',
        node_id: 'calc_pontos',
        start: 10,
        end: 20,
        suggestion: 'valor_item',
      },
    ],
    symbols: [
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ]
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ]
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ]
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
  },
  NewUnitRun: {
    revision: 3,
    inputs: {
      valor_item: '1500.00',
      categoria: 'A',
      meta_atingida: true,
      pontuacoes: [],
    },
  },
  UnitRunOk: {
    status: 'ok',
    outputs: [
      {
        name: 'pontos',
        value: '225.00',
      },
      {
        name: 'elegivel',
        value: true,
      },
    ],
    nodes: [
      {
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: [
          {
            name: 'elegivel',
            value: true,
          },
          {
            name: 'fator',
            value: '0.1500',
          },
        ],
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_historico',
        status: 'ok',
        values: [
          {
            name: 'pontos_historico',
            value: '0.00',
          },
        ],
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_pontos',
        status: 'ok',
        values: [
          {
            name: 'pontos',
            value: '225.00',
          },
        ],
        matched_rule: null,
        warnings: [],
        error: null,
      },
    ],
    error: null,
  },
  UnitRunWithWarnings: {
    status: 'ok_with_warnings',
    outputs: [
      {
        name: 'pontos',
        value: null,
      },
      {
        name: 'elegivel',
        value: true,
      },
    ],
    nodes: [
      {
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: [
          {
            name: 'elegivel',
            value: true,
          },
          {
            name: 'fator',
            value: '0.1500',
          },
        ],
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_historico',
        status: 'ok',
        values: [
          {
            name: 'pontos_historico',
            value: '0.00',
          },
        ],
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_pontos',
        status: 'warning',
        values: [
          {
            name: 'pontos',
            value: null,
          },
        ],
        matched_rule: null,
        warnings: [
          {
            code: 'null_result',
            message: 'O resultado de Pontos ficou nulo; o valor ficou nulo, como pede a política do nó.',
          },
        ],
        error: null,
      },
    ],
    error: null,
  },
  UnitRunError: {
    status: 'error',
    outputs: [],
    nodes: [
      {
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: [
          {
            name: 'elegivel',
            value: true,
          },
          {
            name: 'fator',
            value: '0.1500',
          },
        ],
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_historico',
        status: 'ok',
        values: [
          {
            name: 'pontos_historico',
            value: '0.00',
          },
        ],
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        node_id: 'calc_pontos',
        status: 'error',
        values: [
          {
            name: 'pontos',
            value: null,
          },
        ],
        matched_rule: null,
        warnings: [],
        error: {
          code: 'null_result',
          message: 'O resultado de Pontos ficou nulo.',
        },
      },
    ],
    error: {
      node_id: 'calc_pontos',
      code: 'null_result',
      message: 'O resultado de Pontos ficou nulo.',
    },
  },
  WorkflowExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe um workflow com esse nome.',
    code: 'workflow_exists',
  },
  DraftConflict: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este rascunho mudou em outra aba ou por outra pessoa. Recarregue o rascunho.',
    code: 'draft_conflict',
    current_revision: 4,
  },
  DefinitionTooLarge: {
    type: 'about:blank',
    title: 'Arquivo grande demais',
    status: 413,
    detail: 'O corpo da requisição passa do limite de 1 MB.',
    code: 'definition_too_large',
  },
  InvalidDataDefinition: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      'root.nodes[2].output.scale': 'Use de 0 a 18 casas.',
    },
  },
  DraftHasProblems: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Corrija os problemas do rascunho antes de calcular.',
    code: 'draft_has_problems',
    problems: [
      {
        code: 'type_mismatch',
        message: 'Esperava um número, mas categoria é um texto.',
        path: 'root.nodes[2].expression',
        node_id: 'calc_pontos',
        start: 13,
        end: 22,
        suggestion: null,
      },
    ],
  },
  InvalidInputs: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns valores digitados estão inválidos. Confira as entradas e tente de novo.',
    code: 'invalid_inputs',
    fields: {
      valor_item: 'Use no máximo 2 casas decimais.',
      'pontuacoes[1].taxa': 'Informe um número, com ponto decimal.',
    },
  },
  TooManyConnectionTests: {
    type: 'about:blank',
    title: 'Muitos testes de conexão',
    status: 429,
    detail: 'Muitos testes de conexão em pouco tempo. Aguarde e tente de novo.',
    code: 'too_many_connection_tests',
    retry_after_seconds: 42,
  },
} satisfies Record<string, unknown>;

export type ExampleName = keyof typeof EXAMPLES;
