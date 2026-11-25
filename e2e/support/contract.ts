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
const EXAMPLES_BASE = {
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
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
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
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
        group_id: null,
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: null,
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ],
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ],
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
    groups: [],
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
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
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
    groups: [],
    updated_at: '2026-11-18T13:40:00Z',
    updated_by: {
      id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c',
      name: 'Ana Souza',
    },
  },
  DraftUpdate: {
    revision: 2,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
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
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
        group_id: null,
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: null,
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ],
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ],
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
    groups: [],
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
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
        group_id: null,
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: null,
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ],
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ],
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
    groups: [],
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
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'meta_atingida',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'pontuacoes',
        type: null,
        scale: null,
        cardinality: 'multiple',
        list: null,
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_compra',
        type: 'decimal',
        scale: 2,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'taxa',
        type: 'decimal',
        scale: 4,
        cardinality: 'multiple',
        list: 'pontuacoes',
        origin: 'input',
        node_id: null,
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: null,
      },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
        group_id: null,
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: null,
      },
    ],
    dependencies: [
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
          'meta_atingida',
          'pontuacoes',
        ],
      },
      {
        node_id: 'calc_historico',
        reads: [
          'taxa',
          'valor_compra',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'pontos_historico',
          'valor_item',
        ],
      },
    ],
    order: [
      'td_elegibilidade',
      'calc_historico',
      'calc_pontos',
    ],
    groups: [],
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
    record_key: null,
    inputs: [
      {
        variable: 'valor_item',
        value: '1500.00',
        origin: null,
      },
      {
        variable: 'categoria',
        value: 'A',
        origin: null,
      },
      {
        variable: 'meta_atingida',
        value: true,
        origin: null,
      },
      {
        variable: 'pontuacoes',
        value: [],
        origin: null,
      },
    ],
    nodes: [
      {
        type: 'decision_table',
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: {
          elegivel: true,
          fator: '0.1500',
        },
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_historico',
        status: 'ok',
        values: {
          pontos_historico: '0.00',
        },
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_pontos',
        status: 'ok',
        values: {
          pontos: '225.00',
        },
        matched_rule: null,
        warnings: [],
        error: null,
      },
    ],
    outputs: {
      pontos: '225.00',
      elegivel: true,
    },
    input_hash: 'sha256:75165c8bcd4ca4b534982d17cc7dd60932f8b98416eda295284fc4c82bc6e14f',
    output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
    error: null,
    warnings: [],
  },
  UnitRunWithWarnings: {
    status: 'ok_with_warnings',
    record_key: null,
    inputs: [
      {
        variable: 'valor_item',
        value: null,
        origin: null,
      },
      {
        variable: 'categoria',
        value: 'A',
        origin: null,
      },
      {
        variable: 'meta_atingida',
        value: true,
        origin: null,
      },
      {
        variable: 'pontuacoes',
        value: [],
        origin: null,
      },
    ],
    nodes: [
      {
        type: 'decision_table',
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: {
          elegivel: true,
          fator: '0.1500',
        },
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_historico',
        status: 'ok',
        values: {
          pontos_historico: '0.00',
        },
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_pontos',
        status: 'warning',
        values: {
          pontos: null,
        },
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
    outputs: {
      pontos: null,
      elegivel: true,
    },
    input_hash: 'sha256:ec60fb0c5d12bd069dd5498c64451b245f8403c1a5a8c13f0d7b835c2b607b04',
    output_hash: 'sha256:b2dae4650729170f7fe953112fa31e6594b65c259e48cd90a5c831924c385fc5',
    error: null,
    warnings: [
      {
        node_id: 'calc_pontos',
        code: 'null_result',
        message: 'O resultado de Pontos ficou nulo; o valor ficou nulo, como pede a política do nó.',
        values: {
          fator: '0.1500',
          pontos_historico: '0.00',
          valor_item: null,
        },
      },
    ],
  },
  UnitRunError: {
    status: 'error',
    record_key: null,
    inputs: [
      {
        variable: 'valor_item',
        value: null,
        origin: null,
      },
      {
        variable: 'categoria',
        value: 'A',
        origin: null,
      },
      {
        variable: 'meta_atingida',
        value: true,
        origin: null,
      },
      {
        variable: 'pontuacoes',
        value: [],
        origin: null,
      },
    ],
    nodes: [
      {
        type: 'decision_table',
        node_id: 'td_elegibilidade',
        status: 'ok',
        values: {
          elegivel: true,
          fator: '0.1500',
        },
        matched_rule: 2,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_historico',
        status: 'ok',
        values: {
          pontos_historico: '0.00',
        },
        matched_rule: null,
        warnings: [],
        error: null,
      },
      {
        type: 'calculation',
        node_id: 'calc_pontos',
        status: 'error',
        values: {
          pontos: null,
        },
        matched_rule: null,
        warnings: [],
        error: {
          code: 'null_result',
          message: 'O resultado de Pontos ficou nulo.',
        },
      },
    ],
    outputs: {},
    input_hash: 'sha256:ec60fb0c5d12bd069dd5498c64451b245f8403c1a5a8c13f0d7b835c2b607b04',
    output_hash: null,
    error: {
      node_id: 'calc_pontos',
      code: 'null_result',
      message: 'O resultado de Pontos ficou nulo.',
      values: {
        fator: '0.1500',
        pontos_historico: '0.00',
        valor_item: null,
      },
    },
    warnings: [],
  },
  DraftWithSources: {
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    revision: 4,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
      root: {
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: [
            'nf_id',
            'item_seq',
          ],
          filters: [
            {
              variable: 'status',
              operator: '=',
              values: [
                '"A"',
              ],
            },
          ],
          order_by: [
            {
              variable: 'data_emissao',
              direction: 'asc',
            },
          ],
          outputs: [
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01',
              name: 'nf_id',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02',
              name: 'item_seq',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03',
              name: 'cod_prod',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04',
              name: 'valor_item',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e05',
              name: 'status',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e06',
              name: 'data_emissao',
            },
          ],
        },
        inputs: [],
        nodes: [
          {
            id: 'produto',
            type: 'source',
            name: 'Produto',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            mode: 'linear',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11',
              },
            ],
            filters: [],
            order_by: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12',
                direction: 'desc',
              },
            ],
            no_match: 'error',
            multiple_rows: 'error',
            exists: null,
            outputs: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                name: 'categoria',
              },
            ],
          },
          {
            id: 'campanha',
            type: 'source',
            name: 'Produtos da campanha',
            description: null,
            position: {
              x: 0,
              y: 160,
            },
            mode: 'filter',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
            exists: true,
          },
          {
            id: 'grp_pontuacao',
            type: 'group',
            name: 'Pontuação',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            collapsed: false,
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
                      '"A"',
                    ],
                    then: [
                      'verdadeiro',
                      '0.15',
                    ],
                  },
                  {
                    when: [
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
                id: 'calc_pontos',
                type: 'calculation',
                name: 'Pontos',
                description: null,
                position: {
                  x: 240,
                  y: 0,
                },
                expression: 'ARRED(valor_item * fator, 2)',
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
            outputs: [
              'elegivel',
              'pontos',
            ],
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
        name: 'nf_id',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'item_seq',
        type: 'integer',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'cod_prod',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'status',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'data_emissao',
        type: 'date',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'source',
        node_id: 'produto',
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: 'grp_pontuacao',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: 'grp_pontuacao',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: 'grp_pontuacao',
      },
    ],
    dependencies: [
      {
        node_id: 'produto',
        reads: [
          'cod_prod',
        ],
      },
      {
        node_id: 'campanha',
        reads: [
          'cod_prod',
        ],
      },
      {
        node_id: 'grp_pontuacao',
        reads: [
          'categoria',
          'valor_item',
        ],
      },
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'valor_item',
        ],
      },
    ],
    order: [
      'produto',
      'campanha',
      'grp_pontuacao',
    ],
    groups: [
      {
        node_id: 'grp_pontuacao',
        inputs: [
          'categoria',
          'valor_item',
        ],
        outputs: [
          'elegivel',
          'pontos',
        ],
        order: [
          'td_elegibilidade',
          'calc_pontos',
        ],
      },
    ],
    updated_at: '2026-11-21T10:15:00Z',
    updated_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
  },
  DraftUpdateWithSources: {
    revision: 3,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
      root: {
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: [
            'nf_id',
            'item_seq',
          ],
          filters: [
            {
              variable: 'status',
              operator: '=',
              values: [
                '"A"',
              ],
            },
          ],
          order_by: [
            {
              variable: 'data_emissao',
              direction: 'asc',
            },
          ],
          outputs: [
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01',
              name: 'nf_id',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02',
              name: 'item_seq',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03',
              name: 'cod_prod',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04',
              name: 'valor_item',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e05',
              name: 'status',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e06',
              name: 'data_emissao',
            },
          ],
        },
        inputs: [],
        nodes: [
          {
            id: 'produto',
            type: 'source',
            name: 'Produto',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            mode: 'linear',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11',
              },
            ],
            filters: [],
            order_by: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12',
                direction: 'desc',
              },
            ],
            no_match: 'error',
            multiple_rows: 'error',
            exists: null,
            outputs: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                name: 'categoria',
              },
            ],
          },
          {
            id: 'campanha',
            type: 'source',
            name: 'Produtos da campanha',
            description: null,
            position: {
              x: 0,
              y: 160,
            },
            mode: 'filter',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
            exists: true,
          },
          {
            id: 'grp_pontuacao',
            type: 'group',
            name: 'Pontuação',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            collapsed: false,
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
                      '"A"',
                    ],
                    then: [
                      'verdadeiro',
                      '0.15',
                    ],
                  },
                  {
                    when: [
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
                id: 'calc_pontos',
                type: 'calculation',
                name: 'Pontos',
                description: null,
                position: {
                  x: 240,
                  y: 0,
                },
                expression: 'ARRED(valor_item * fator, 2)',
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
            outputs: [
              'elegivel',
              'pontos',
            ],
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
  DraftDefinitionInvalid: {
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    revision: 4,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [],
      root: {
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: [
            'nf_id',
            'item_seq',
          ],
          filters: [
            {
              variable: 'status',
              operator: '=',
              values: [
                '"A"',
              ],
            },
          ],
          order_by: [
            {
              variable: 'data_emissao',
              direction: 'asc',
            },
          ],
          outputs: [
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01',
              name: 'nf_id',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02',
              name: 'item_seq',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03',
              name: 'cod_prod',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04',
              name: 'valor_item',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e05',
              name: 'status',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e06',
              name: 'data_emissao',
            },
          ],
        },
        inputs: [],
        nodes: [
          {
            id: 'produto',
            type: 'source',
            name: 'Produto',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            mode: 'linear',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11',
              },
            ],
            filters: [],
            order_by: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12',
                direction: 'desc',
              },
            ],
            no_match: 'error',
            multiple_rows: 'error',
            exists: true,
            outputs: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                name: 'categoria',
              },
            ],
          },
          {
            id: 'campanha',
            type: 'source',
            name: 'Produtos da campanha',
            description: null,
            position: {
              x: 0,
              y: 160,
            },
            mode: 'filter',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
            exists: true,
          },
          {
            id: 'grp_pontuacao',
            type: 'group',
            name: 'Pontuação',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            collapsed: false,
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
                      '"A"',
                    ],
                    then: [
                      'verdadeiro',
                      '0.15',
                    ],
                  },
                  {
                    when: [
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
                id: 'calc_pontos',
                type: 'calculation',
                name: 'Pontos',
                description: null,
                position: {
                  x: 240,
                  y: 0,
                },
                expression: 'ARRED(valor_item * fator, 2)',
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
            outputs: [
              'elegivel',
              'pontos',
            ],
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
    problems: [
      {
        code: 'definition_invalid',
        message: 'Este campo não é mais aceito. Corrija-o e salve de novo.',
        path: 'root.nodes[0].exists',
        node_id: 'produto',
        start: null,
        end: null,
        suggestion: null,
      },
    ],
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: '2026-11-21T10:15:00Z',
    updated_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
  },
  AnalysisNotVisible: {
    problems: [
      {
        code: 'not_visible',
        message: 'pontos existe, mas não é visível aqui. Ela está dentro do grupo Pontuação.',
        path: 'root.output.fields[0].variable',
        node_id: null,
        start: null,
        end: null,
        suggestion: null,
      },
    ],
    symbols: [
      {
        name: 'nf_id',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'item_seq',
        type: 'integer',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'cod_prod',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'valor_item',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'status',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'data_emissao',
        type: 'date',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'batch_source',
        node_id: null,
        group_id: null,
      },
      {
        name: 'categoria',
        type: 'text',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'source',
        node_id: 'produto',
        group_id: null,
      },
      {
        name: 'elegivel',
        type: 'boolean',
        scale: null,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: 'grp_pontuacao',
      },
      {
        name: 'fator',
        type: 'decimal',
        scale: 4,
        cardinality: 'linear',
        list: null,
        origin: 'decision_table',
        node_id: 'td_elegibilidade',
        group_id: 'grp_pontuacao',
      },
      {
        name: 'pontos',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_pontos',
        group_id: 'grp_pontuacao',
      },
    ],
    dependencies: [
      {
        node_id: 'produto',
        reads: [
          'cod_prod',
        ],
      },
      {
        node_id: 'campanha',
        reads: [
          'cod_prod',
        ],
      },
      {
        node_id: 'grp_pontuacao',
        reads: [
          'categoria',
          'valor_item',
        ],
      },
      {
        node_id: 'td_elegibilidade',
        reads: [
          'categoria',
        ],
      },
      {
        node_id: 'calc_pontos',
        reads: [
          'fator',
          'valor_item',
        ],
      },
    ],
    order: [
      'produto',
      'campanha',
      'grp_pontuacao',
    ],
    groups: [
      {
        node_id: 'grp_pontuacao',
        inputs: [
          'categoria',
          'valor_item',
        ],
        outputs: [
          'elegivel',
        ],
        order: [
          'td_elegibilidade',
          'calc_pontos',
        ],
      },
    ],
  },
  NewPreview: {
    revision: 4,
    sample_size: 20,
  },
  Preview: {
    counted_records: 500,
    total_known: false,
    sources: [
      {
        node_id: 'produto',
        mode: 'linear',
        found: 480,
        no_match: 12,
        multiple_rows: 8,
        max_rows: 3,
        no_match_keys: [
          {
            nf_id: '17',
            item_seq: '2',
          },
          {
            nf_id: '23',
            item_seq: '1',
          },
        ],
        multiple_rows_keys: [
          {
            nf_id: '12',
            item_seq: '3',
          },
        ],
        kept: null,
        filtered: null,
        rows: [
          {
            categoria: 'A',
          },
          {
            categoria: 'B',
          },
        ],
      },
      {
        node_id: 'campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        max_rows: null,
        no_match_keys: [],
        multiple_rows_keys: [],
        kept: 450,
        filtered: 50,
        rows: [
          {
            cod_prod: 'P-001',
          },
          {
            cod_prod: 'P-002',
          },
        ],
      },
    ],
    groups: [
      {
        node_id: null,
        records: [
          {
            record_key: {
              nf_id: '10',
              item_seq: '1',
            },
            status: 'ok',
            inputs: {
              nf_id: '10',
              item_seq: '1',
              cod_prod: 'P-001',
              valor_item: '1500.00',
              status: 'A',
              data_emissao: '2026-10-05',
            },
            outputs: {
              pontos: '225.00',
              elegivel: true,
            },
          },
          {
            record_key: {
              nf_id: '10',
              item_seq: '2',
            },
            status: 'filtered',
            inputs: {
              nf_id: '10',
              item_seq: '2',
              cod_prod: 'P-207',
              valor_item: '80.00',
              status: 'A',
              data_emissao: '2026-10-05',
            },
            outputs: {},
          },
        ],
      },
      {
        node_id: 'grp_pontuacao',
        records: [
          {
            record_key: {
              nf_id: '10',
              item_seq: '1',
            },
            status: 'ok',
            inputs: {
              categoria: 'A',
              valor_item: '1500.00',
            },
            outputs: {
              elegivel: true,
              pontos: '225.00',
            },
          },
        ],
      },
    ],
    error: null,
  },
  PreviewSchemaDrift: {
    counted_records: 0,
    total_known: false,
    sources: [],
    groups: [],
    error: {
      node_id: null,
      code: 'schema_drift',
      message: '`ItensNF.vl_itm` não existe mais na origem.',
      values: {},
    },
  },
  PreviewSourceReadDenied: {
    counted_records: 0,
    total_known: false,
    sources: [],
    groups: [],
    error: {
      node_id: 'produto',
      code: 'source_read_denied',
      message: 'O usuário da conexão não pode ler o dataset Produtos. Peça a permissão de leitura (SELECT) a quem cuida do banco.',
      values: {},
    },
  },
  PreviewParameterTableRows: {
    counted_records: 0,
    total_known: false,
    sources: [],
    groups: [],
    error: {
      node_id: 'fatores',
      code: 'parameter_table_rows',
      message: 'A tabela de parâmetros Fatores tem 2 linhas depois dos filtros; ela precisa de exatamente 1.',
      values: {},
    },
  },
  NewUnitRunWithRecordKey: {
    revision: 4,
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
  },
  UnitRunTrace: {
    status: 'ok',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    inputs: [
      {
        variable: 'nf_id',
        value: '10',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'nf_id',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'item_seq',
        value: '1',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'item_seq',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'cod_prod',
        value: 'P-001',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'cod_prod',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'valor_item',
        value: '1500.00',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'vl_itm',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'status',
        value: 'A',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'status',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'data_emissao',
        value: '2026-10-05',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'dt_emissao',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'categoria',
        value: 'A',
        origin: {
          connection: 'Cadastro',
          dataset: 'Produtos',
          column: 'categoria',
          row_key: {
            cod_prod: 'P-001',
          },
        },
      },
    ],
    nodes: [
      {
        type: 'source',
        node_id: 'produto',
        status: 'ok',
        values: {
          categoria: 'A',
        },
        rows_found: 1,
        warnings: [],
        error: null,
      },
      {
        type: 'source',
        node_id: 'campanha',
        status: 'ok',
        values: {},
        rows_found: 1,
        warnings: [],
        error: null,
      },
      {
        type: 'group',
        node_id: 'grp_pontuacao',
        status: 'ok',
        inputs: {
          categoria: 'A',
          valor_item: '1500.00',
        },
        outputs: {
          elegivel: true,
          pontos: '225.00',
        },
        nodes: [
          {
            type: 'decision_table',
            node_id: 'td_elegibilidade',
            status: 'ok',
            values: {
              elegivel: true,
              fator: '0.1500',
            },
            matched_rule: 1,
            warnings: [],
            error: null,
          },
          {
            type: 'calculation',
            node_id: 'calc_pontos',
            status: 'ok',
            values: {
              pontos: '225.00',
            },
            matched_rule: null,
            warnings: [],
            error: null,
          },
        ],
      },
    ],
    outputs: {
      pontos: '225.00',
      elegivel: true,
    },
    input_hash: 'sha256:77b0db21bf50cd73110d3ba398acc52c9d59e1ff5b3a3cb10d67e03f86560506',
    output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
    error: null,
    warnings: [],
  },
  UnitRunFiltered: {
    status: 'filtered',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    inputs: [
      {
        variable: 'nf_id',
        value: '10',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'nf_id',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'item_seq',
        value: '1',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'item_seq',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'cod_prod',
        value: 'P-207',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'cod_prod',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'valor_item',
        value: '1500.00',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'vl_itm',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'status',
        value: 'A',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'status',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'data_emissao',
        value: '2026-10-05',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'dt_emissao',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'categoria',
        value: 'B',
        origin: {
          connection: 'Cadastro',
          dataset: 'Produtos',
          column: 'categoria',
          row_key: {
            cod_prod: 'P-207',
          },
        },
      },
    ],
    nodes: [
      {
        type: 'source',
        node_id: 'produto',
        status: 'ok',
        values: {
          categoria: 'B',
        },
        rows_found: 1,
        warnings: [],
        error: null,
      },
      {
        type: 'source',
        node_id: 'campanha',
        status: 'ok',
        values: {},
        rows_found: 0,
        warnings: [],
        error: null,
      },
      {
        type: 'group',
        node_id: 'grp_pontuacao',
        status: 'not_run',
        inputs: {},
        outputs: {},
        nodes: [],
      },
    ],
    outputs: {},
    input_hash: 'sha256:355e55c44700ceb2c8dc3c317501c9d5999bdba3e5237f5922c6fd55c3020c28',
    output_hash: null,
    error: null,
    warnings: [],
  },
  UnitRunIgnored: {
    status: 'ignored',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    inputs: [
      {
        variable: 'nf_id',
        value: '10',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'nf_id',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'item_seq',
        value: '1',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'item_seq',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'cod_prod',
        value: 'P-999',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'cod_prod',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'valor_item',
        value: '1500.00',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'vl_itm',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'status',
        value: 'A',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'status',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
      {
        variable: 'data_emissao',
        value: '2026-10-05',
        origin: {
          connection: 'ERP',
          dataset: 'Itens NF',
          column: 'dt_emissao',
          row_key: {
            nf_id: '10',
            item_seq: '1',
          },
        },
      },
    ],
    nodes: [
      {
        type: 'source',
        node_id: 'produto',
        status: 'warning',
        values: {
          categoria: null,
        },
        rows_found: 0,
        warnings: [
          {
            code: 'no_match',
            message: 'Produto não achou linha para cod_prod P-999; o registro foi ignorado, como pede a política do bloco.',
          },
        ],
        error: null,
      },
      {
        type: 'source',
        node_id: 'campanha',
        status: 'not_run',
        values: {},
        rows_found: 0,
        warnings: [],
        error: null,
      },
      {
        type: 'group',
        node_id: 'grp_pontuacao',
        status: 'not_run',
        inputs: {},
        outputs: {},
        nodes: [],
      },
    ],
    outputs: {},
    input_hash: 'sha256:5e23424ffc8c1666801e8b7e0e6aa076de19490df7233c151e4d40855ba4606b',
    output_hash: null,
    error: null,
    warnings: [
      {
        node_id: 'produto',
        code: 'no_match',
        message: 'Produto não achou linha para cod_prod P-999; o registro foi ignorado, como pede a política do bloco.',
        values: {
          cod_prod: 'P-999',
        },
      },
    ],
  },
  UnitRunSchemaDrift: {
    status: 'error',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    inputs: [],
    nodes: [],
    outputs: {},
    input_hash: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    output_hash: null,
    error: {
      node_id: null,
      code: 'schema_drift',
      message: '`ItensNF.vl_itm` não existe mais na origem.',
      values: {},
    },
    warnings: [],
  },
  PreviewDraftHasProblems: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Corrija os problemas do rascunho antes de rodar a prévia.',
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
  SourceRemovedFromCatalog: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Corrija os problemas do rascunho e tente de novo.',
    code: 'draft_has_problems',
    problems: [
      {
        node_id: 'produto',
        path: 'root.nodes[0].dataset_id',
        code: 'unknown_dataset',
        message: 'O dataset de Produto não existe mais no catálogo.',
        start: null,
        end: null,
        suggestion: null,
      },
    ],
  },
  NoBatchSource: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow não tem fonte do lote. Escolha a fonte do lote para rodar a prévia.',
    code: 'no_batch_source',
  },
  RecordNotFound: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'Nenhum registro com essa chave.',
    code: 'record_not_found',
  },
  InvalidDataPreview: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      sample_size: 'Use de 1 a 100.',
    },
  },
  WorkflowExists: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe um workflow com esse nome.',
    code: 'workflow_exists',
  },
  WorkflowHasExecutions: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow já tem execuções e não pode ser apagado.',
    code: 'workflow_has_executions',
  },
  WorkflowBusy: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow está em uso por outra operação. Tente de novo em instantes.',
    code: 'workflow_busy',
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
  DraftUpdateWithParameters: {
    revision: 4,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [
        {
          name: 'periodo',
          type: 'period',
          required: true,
          list: false,
          scale: null,
          default: {
            kind: 'relative',
            value: 'previous_month',
          },
          allowed_values: null,
          description: 'Mês de emissão das notas',
        },
        {
          name: 'meta_minima',
          type: 'decimal',
          required: true,
          list: false,
          scale: 2,
          default: null,
          allowed_values: null,
          description: 'Valor mínimo do item para entrar no lote',
        },
        {
          name: 'categorias',
          type: 'text',
          required: false,
          list: true,
          scale: null,
          default: {
            kind: 'fixed',
            value: [
              '"A"',
              '"B"',
            ],
          },
          allowed_values: [
            '"A"',
            '"B"',
            '"C"',
          ],
          description: 'Categorias de produto que pontuam',
        },
      ],
      root: {
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: [
            'nf_id',
            'item_seq',
          ],
          filters: [
            {
              variable: 'status',
              operator: '=',
              values: [
                '"A"',
              ],
            },
            {
              variable: 'data_emissao',
              operator: 'between',
              values: [
                '@periodo.inicio',
                '@periodo.fim',
              ],
            },
            {
              variable: 'valor_item',
              operator: '>=',
              values: [
                '@meta_minima',
              ],
            },
          ],
          order_by: [
            {
              variable: 'data_emissao',
              direction: 'asc',
            },
          ],
          outputs: [
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01',
              name: 'nf_id',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02',
              name: 'item_seq',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03',
              name: 'cod_prod',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04',
              name: 'valor_item',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e05',
              name: 'status',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e06',
              name: 'data_emissao',
            },
          ],
        },
        inputs: [],
        nodes: [
          {
            id: 'produto',
            type: 'source',
            name: 'Produto',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            mode: 'linear',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                operator: 'in',
                values: [
                  '@categorias',
                ],
              },
            ],
            order_by: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12',
                direction: 'desc',
              },
            ],
            no_match: 'keep_null',
            multiple_rows: 'error',
            exists: null,
            outputs: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                name: 'categoria',
              },
            ],
          },
          {
            id: 'campanha',
            type: 'source',
            name: 'Produtos da campanha',
            description: null,
            position: {
              x: 0,
              y: 160,
            },
            mode: 'filter',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
            exists: true,
          },
          {
            id: 'grp_pontuacao',
            type: 'group',
            name: 'Pontuação',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            collapsed: false,
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
                      '"A"',
                    ],
                    then: [
                      'verdadeiro',
                      '0.15',
                    ],
                  },
                  {
                    when: [
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
                id: 'calc_pontos',
                type: 'calculation',
                name: 'Pontos',
                description: null,
                position: {
                  x: 240,
                  y: 0,
                },
                expression: 'ARRED(valor_item * fator, 2)',
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
            outputs: [
              'elegivel',
              'pontos',
            ],
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
  NewPreviewWithParameters: {
    revision: 5,
    sample_size: 20,
    parameters: {
      meta_minima: '100.00',
    },
  },
  NewUnitRunWithParameters: {
    revision: 5,
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      meta_minima: '100.00',
    },
  },
  NewExecution: {
    revision: 5,
    parameters: {
      meta_minima: '100.00',
    },
  },
  NewExecutionInvalidPeriod: {
    revision: 5,
    parameters: {
      meta_minima: '100.00',
      periodo: {
        start: '2026-10-31',
        end: '2026-10-01',
      },
    },
  },
  MissingParameter: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Falta o valor de um parâmetro obrigatório. Informe-o e tente de novo.',
    code: 'missing_parameter',
    fields: {
      meta_minima: 'Informe um valor; o parâmetro é obrigatório e não tem padrão.',
    },
  },
  InvalidParameter: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns parâmetros estão inválidos. Confira os valores e tente de novo.',
    code: 'invalid_parameter',
    fields: {
      periodo: 'O início do período vem depois do fim.',
    },
  },
  ExecutionDraftHasProblems: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Corrija os problemas do rascunho antes de rodar a execução.',
    code: 'draft_has_problems',
    problems: [
      {
        code: 'unknown_parameter',
        message: '@categoria não é um parâmetro deste fluxo. Você quis dizer @categorias?',
        path: 'root.nodes[0].filters[0].values[0]',
        node_id: 'produto',
        start: null,
        end: null,
        suggestion: 'categorias',
      },
    ],
  },
  ExecutionNoBatchSource: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow não tem fonte do lote. Escolha a fonte do lote para rodar a execução.',
    code: 'no_batch_source',
  },
  ExecutionFinished: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Esta execução já terminou e não pode mais ser cancelada.',
    code: 'execution_finished',
  },
  OutputNotAvailable: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'Esta execução não tem arquivo para baixar.',
    code: 'output_not_available',
  },
  OutputExpired: {
    type: 'about:blank',
    title: 'Não está mais disponível',
    status: 410,
    detail: 'O prazo para baixar o arquivo desta execução passou e ele foi apagado.',
    code: 'output_expired',
  },
  ExecutionRecordNotFound: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'Esta execução não tem registro com essa chave.',
    code: 'record_not_found',
  },
  InvalidDataRecordStatus: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      status: 'Use um status de registro válido.',
    },
  },
  InvalidDataResultKey: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      result_key: 'Informe a chave do resultado com 64 caracteres hexadecimais.',
    },
  },
  ExecutionPending: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c06',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'pending',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T15:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T15:00:00Z',
    started_at: null,
    data_read_at: null,
    finished_at: null,
    next_retry_at: null,
    total_records: null,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionCompleted: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'completed',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T12:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T12:00:00Z',
    started_at: '2026-11-21T12:00:02Z',
    data_read_at: '2026-11-21T12:00:03Z',
    finished_at: '2026-11-21T12:00:05Z',
    next_retry_at: null,
    total_records: 2,
    progress: {
      chunks_done: 1,
      records_done: 2,
    },
    totals: {
      read: 2,
      ok: 1,
      ok_with_warnings: 1,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: true,
      expires_at: '2026-11-28T12:00:05Z',
      rows: 2,
    },
    pre_validation: {
      status: 'passed',
      records: 2,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1,
        no_match: 1,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 2,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionCompletedWithErrors: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c02',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'completed_with_errors',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T13:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T13:00:00Z',
    started_at: '2026-11-21T13:00:01Z',
    data_read_at: '2026-11-21T13:00:02Z',
    finished_at: '2026-11-21T13:10:40Z',
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 2,
      records_done: 1200,
    },
    totals: {
      read: 1200,
      ok: 1100,
      ok_with_warnings: 90,
      error: 2,
      ignored: 0,
      filtered: 8,
    },
    error_groups: [
      {
        node_id: null,
        node_name: null,
        code: 'null_record_key',
        count: 1,
      },
      {
        node_id: null,
        node_name: null,
        code: 'duplicate_record_key',
        count: 1,
      },
    ],
    output: {
      available: true,
      expires_at: '2026-11-28T13:10:40Z',
      rows: 1190,
    },
    pre_validation: {
      status: 'passed',
      records: 1200,
      empty_rows: 0,
      null_key_records: 1,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1108,
        no_match: 90,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 1190,
        filtered: 8,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionAborted: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c03',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'aborted',
    abort_reason: {
      code: 'error_limit_exceeded',
      message: 'Os erros passaram do limite de erro do workflow. Nada foi entregue.',
    },
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T13:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T13:30:00Z',
    started_at: '2026-11-21T13:30:01Z',
    data_read_at: '2026-11-21T13:30:02Z',
    finished_at: '2026-11-21T13:35:12Z',
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 1,
      records_done: 1000,
    },
    totals: {
      read: 1000,
      ok: 850,
      ok_with_warnings: 30,
      error: 120,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        code: 'multiple_rows',
        count: 120,
      },
    ],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 1200,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 850,
        no_match: 30,
        multiple_rows: 120,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 880,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionCancelled: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'cancelled',
    abort_reason: null,
    cancel_requested_at: '2026-11-21T14:00:01Z',
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T14:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T14:00:00Z',
    started_at: null,
    data_read_at: null,
    finished_at: '2026-11-21T14:00:01Z',
    next_retry_at: null,
    total_records: null,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionCalculating: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c05',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'calculating',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T14:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T14:30:00Z',
    started_at: '2026-11-21T14:30:01Z',
    data_read_at: '2026-11-21T14:30:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 1,
      records_done: 1000,
    },
    totals: {
      read: 1000,
      ok: 990,
      ok_with_warnings: 5,
      error: 1,
      ignored: 0,
      filtered: 4,
    },
    error_groups: [
      {
        node_id: null,
        node_name: null,
        code: 'null_record_key',
        count: 1,
      },
    ],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 1200,
      empty_rows: 0,
      null_key_records: 1,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 994,
        no_match: 5,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 995,
        filtered: 4,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionCancelRequested: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c05',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'calculating',
    abort_reason: null,
    cancel_requested_at: '2026-11-21T14:31:00Z',
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T14:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T14:30:00Z',
    started_at: '2026-11-21T14:30:01Z',
    data_read_at: '2026-11-21T14:30:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 1,
      records_done: 1000,
    },
    totals: {
      read: 1000,
      ok: 990,
      ok_with_warnings: 5,
      error: 1,
      ignored: 0,
      filtered: 4,
    },
    error_groups: [
      {
        node_id: null,
        node_name: null,
        code: 'null_record_key',
        count: 1,
      },
    ],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 1200,
      empty_rows: 0,
      null_key_records: 1,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 994,
        no_match: 5,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 995,
        filtered: 4,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionAwaitingSource: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c08',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'awaiting_source',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-21T15:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-21T15:30:00Z',
    started_at: '2026-11-21T15:30:01Z',
    data_read_at: null,
    finished_at: null,
    next_retry_at: '2026-11-21T15:30:34Z',
    total_records: null,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionList: {
    items: [
      {
        id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c05',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        workflow_name: 'Pontuação de exemplo',
        draft_revision: 5,
        workflow_version: null,
        mode: 'batch',
        status: 'calculating',
        abort_reason: null,
        cancel_requested_at: null,
        parameters: {
          periodo: {
            start: '2026-10-01',
            end: '2026-10-31',
          },
          categorias: [
            'A',
            'B',
          ],
          meta_minima: '100.00',
        },
        now: '2026-11-21T14:30:00Z',
        trace_level: 'standard',
        error_limit_percent: '5',
        triggered_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        schedule: null,
        created_at: '2026-11-21T14:30:00Z',
        started_at: '2026-11-21T14:30:01Z',
        data_read_at: '2026-11-21T14:30:02Z',
        finished_at: null,
        next_retry_at: null,
        total_records: 1200,
        progress: {
          chunks_done: 1,
          records_done: 1000,
        },
        totals: {
          read: 1000,
          ok: 990,
          ok_with_warnings: 5,
          error: 1,
          ignored: 0,
          filtered: 4,
        },
        error_groups: [
          {
            node_id: null,
            node_name: null,
            code: 'null_record_key',
            count: 1,
          },
        ],
        output: {
          available: false,
          expires_at: null,
          rows: null,
        },
        pre_validation: {
          status: 'passed',
          records: 1200,
          empty_rows: 0,
          null_key_records: 1,
          duplicate_keys: {
            count: 0,
            examples: [],
          },
          empty_values: [],
          alert_percent: '1',
          decision: null,
          decision_expires_at: null,
        },
        source_counts: [
          {
            node_id: 'produto',
            node_name: 'Produto',
            mode: 'linear',
            found: 994,
            no_match: 5,
            multiple_rows: 0,
            kept: null,
            filtered: null,
          },
          {
            node_id: 'campanha',
            node_name: 'Produtos da campanha',
            mode: 'filter',
            found: null,
            no_match: null,
            multiple_rows: null,
            kept: 995,
            filtered: 4,
          },
        ],
        overlap_of: null,
        reference_file: null,
        comparison: null,
      },
      {
        id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        workflow_name: 'Pontuação de exemplo',
        draft_revision: 5,
        workflow_version: null,
        mode: 'batch',
        status: 'completed',
        abort_reason: null,
        cancel_requested_at: null,
        parameters: {
          periodo: {
            start: '2026-10-01',
            end: '2026-10-31',
          },
          categorias: [
            'A',
            'B',
          ],
          meta_minima: '100.00',
        },
        now: '2026-11-21T12:00:00Z',
        trace_level: 'standard',
        error_limit_percent: '5',
        triggered_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        schedule: null,
        created_at: '2026-11-21T12:00:00Z',
        started_at: '2026-11-21T12:00:02Z',
        data_read_at: '2026-11-21T12:00:03Z',
        finished_at: '2026-11-21T12:00:05Z',
        next_retry_at: null,
        total_records: 2,
        progress: {
          chunks_done: 1,
          records_done: 2,
        },
        totals: {
          read: 2,
          ok: 1,
          ok_with_warnings: 1,
          error: 0,
          ignored: 0,
          filtered: 0,
        },
        error_groups: [],
        output: {
          available: true,
          expires_at: '2026-11-28T12:00:05Z',
          rows: 2,
        },
        pre_validation: {
          status: 'passed',
          records: 2,
          empty_rows: 0,
          null_key_records: 0,
          duplicate_keys: {
            count: 0,
            examples: [],
          },
          empty_values: [],
          alert_percent: '1',
          decision: null,
          decision_expires_at: null,
        },
        source_counts: [
          {
            node_id: 'produto',
            node_name: 'Produto',
            mode: 'linear',
            found: 1,
            no_match: 1,
            multiple_rows: 0,
            kept: null,
            filtered: null,
          },
          {
            node_id: 'campanha',
            node_name: 'Produtos da campanha',
            mode: 'filter',
            found: null,
            no_match: null,
            multiple_rows: null,
            kept: 2,
            filtered: 0,
          },
        ],
        overlap_of: null,
        reference_file: null,
        comparison: null,
      },
    ],
    next_cursor: null,
  },
  ExecutionOutputCsv: 'result_key,revision,run_id,workflow_version,status,nf_id,item_seq,pontos,elegivel,_warnings\r\n3a1340afb3a61f11f38860492e8829ce0fd8b1cba0c7eb44e1820912a3e2d482,1,6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01,,ok,10,1,225.00,true,\r\n0ae47b7fb851a06a5219fe997f22d58af265de01202de00969906123084ad19b,1,6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01,,ok_with_warnings,10,2,80.00,true,no_match\r\n',
  ExecutionRecordList: {
    items: [
      {
        result_key: '3a1340afb3a61f11f38860492e8829ce0fd8b1cba0c7eb44e1820912a3e2d482',
        record_key: {
          nf_id: '10',
          item_seq: '1',
        },
        status: 'ok',
        error_node_id: null,
        error_code: null,
      },
      {
        result_key: '0ae47b7fb851a06a5219fe997f22d58af265de01202de00969906123084ad19b',
        record_key: {
          nf_id: '10',
          item_seq: '2',
        },
        status: 'ok_with_warnings',
        error_node_id: null,
        error_code: null,
      },
      {
        result_key: null,
        record_key: {
          nf_id: null,
          item_seq: '1',
        },
        status: 'error',
        error_node_id: null,
        error_code: 'null_record_key',
      },
      {
        result_key: null,
        record_key: {
          nf_id: '11',
          item_seq: '1',
        },
        status: 'error',
        error_node_id: null,
        error_code: 'duplicate_record_key',
      },
    ],
    next_cursor: 'eyJjaHVuayI6MSwicm93Ijo0fQ',
  },
  ExecutionRecordStandard: {
    execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c02',
    trace_level: 'standard',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    status: 'ok',
    input_hash: 'sha256:77b0db21bf50cd73110d3ba398acc52c9d59e1ff5b3a3cb10d67e03f86560506',
    output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
    outputs: {
      pontos: '225.00',
      elegivel: true,
    },
    trace: {
      status: 'ok',
      record_key: {
        nf_id: '10',
        item_seq: '1',
      },
      inputs: [
        {
          variable: 'nf_id',
          value: '10',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'nf_id',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'item_seq',
          value: '1',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'item_seq',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'cod_prod',
          value: 'P-001',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'cod_prod',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'valor_item',
          value: '1500.00',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'vl_itm',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'status',
          value: 'A',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'status',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'data_emissao',
          value: '2026-10-05',
          origin: {
            connection: 'ERP',
            dataset: 'Itens NF',
            column: 'dt_emissao',
            row_key: {
              nf_id: '10',
              item_seq: '1',
            },
          },
        },
        {
          variable: 'categoria',
          value: 'A',
          origin: {
            connection: 'Cadastro',
            dataset: 'Produtos',
            column: 'categoria',
            row_key: {
              cod_prod: 'P-001',
            },
          },
        },
      ],
      nodes: [
        {
          type: 'source',
          node_id: 'produto',
          status: 'ok',
          values: {
            categoria: 'A',
          },
          rows_found: 1,
          warnings: [],
          error: null,
        },
        {
          type: 'source',
          node_id: 'campanha',
          status: 'ok',
          values: {},
          rows_found: 1,
          warnings: [],
          error: null,
        },
        {
          type: 'group',
          node_id: 'grp_pontuacao',
          status: 'ok',
          inputs: {
            categoria: 'A',
            valor_item: '1500.00',
          },
          outputs: {
            elegivel: true,
            pontos: '225.00',
          },
          nodes: [
            {
              type: 'decision_table',
              node_id: 'td_elegibilidade',
              status: 'ok',
              values: {
                elegivel: true,
                fator: '0.1500',
              },
              matched_rule: 1,
              warnings: [],
              error: null,
            },
            {
              type: 'calculation',
              node_id: 'calc_pontos',
              status: 'ok',
              values: {
                pontos: '225.00',
              },
              matched_rule: null,
              warnings: [],
              error: null,
            },
          ],
        },
      ],
      outputs: {
        pontos: '225.00',
        elegivel: true,
      },
      input_hash: 'sha256:77b0db21bf50cd73110d3ba398acc52c9d59e1ff5b3a3cb10d67e03f86560506',
      output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
      error: null,
      warnings: [],
    },
  },
  ExecutionRecordMinimal: {
    execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c07',
    trace_level: 'minimal',
    record_key: {
      nf_id: '10',
      item_seq: '1',
    },
    status: 'ok',
    input_hash: 'sha256:77b0db21bf50cd73110d3ba398acc52c9d59e1ff5b3a3cb10d67e03f86560506',
    output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
    outputs: null,
    trace: null,
  },
  ExecutionDefinition: {
    draft_revision: 5,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [
        {
          name: 'periodo',
          type: 'period',
          required: true,
          list: false,
          scale: null,
          default: {
            kind: 'relative',
            value: 'previous_month',
          },
          allowed_values: null,
          description: 'Mês de emissão das notas',
        },
        {
          name: 'meta_minima',
          type: 'decimal',
          required: true,
          list: false,
          scale: 2,
          default: null,
          allowed_values: null,
          description: 'Valor mínimo do item para entrar no lote',
        },
        {
          name: 'categorias',
          type: 'text',
          required: false,
          list: true,
          scale: null,
          default: {
            kind: 'fixed',
            value: [
              '"A"',
              '"B"',
            ],
          },
          allowed_values: [
            '"A"',
            '"B"',
            '"C"',
          ],
          description: 'Categorias de produto que pontuam',
        },
      ],
      root: {
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: [
            'nf_id',
            'item_seq',
          ],
          filters: [
            {
              variable: 'status',
              operator: '=',
              values: [
                '"A"',
              ],
            },
            {
              variable: 'data_emissao',
              operator: 'between',
              values: [
                '@periodo.inicio',
                '@periodo.fim',
              ],
            },
            {
              variable: 'valor_item',
              operator: '>=',
              values: [
                '@meta_minima',
              ],
            },
          ],
          order_by: [
            {
              variable: 'data_emissao',
              direction: 'asc',
            },
          ],
          outputs: [
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01',
              name: 'nf_id',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02',
              name: 'item_seq',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03',
              name: 'cod_prod',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04',
              name: 'valor_item',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e05',
              name: 'status',
            },
            {
              variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e06',
              name: 'data_emissao',
            },
          ],
        },
        inputs: [],
        nodes: [
          {
            id: 'produto',
            type: 'source',
            name: 'Produto',
            description: null,
            position: {
              x: 0,
              y: 0,
            },
            mode: 'linear',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                operator: 'in',
                values: [
                  '@categorias',
                ],
              },
            ],
            order_by: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12',
                direction: 'desc',
              },
            ],
            no_match: 'keep_null',
            multiple_rows: 'error',
            exists: null,
            outputs: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13',
                name: 'categoria',
              },
            ],
          },
          {
            id: 'campanha',
            type: 'source',
            name: 'Produtos da campanha',
            description: null,
            position: {
              x: 0,
              y: 160,
            },
            mode: 'filter',
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
            links: [
              {
                variable: 'cod_prod',
                column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21',
              },
            ],
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
            exists: true,
          },
          {
            id: 'grp_pontuacao',
            type: 'group',
            name: 'Pontuação',
            description: null,
            position: {
              x: 240,
              y: 0,
            },
            collapsed: false,
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
                      '"A"',
                    ],
                    then: [
                      'verdadeiro',
                      '0.15',
                    ],
                  },
                  {
                    when: [
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
                id: 'calc_pontos',
                type: 'calculation',
                name: 'Pontos',
                description: null,
                position: {
                  x: 240,
                  y: 0,
                },
                expression: 'ARRED(valor_item * fator, 2)',
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
            outputs: [
              'elegivel',
              'pontos',
            ],
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
  ExecutionRecordListWithoutNode: {
    items: [
      {
        result_key: null,
        record_key: {
          nf_id: null,
          item_seq: '1',
        },
        status: 'error',
        error_node_id: null,
        error_code: 'null_record_key',
      },
      {
        result_key: null,
        record_key: {
          nf_id: '11',
          item_seq: '1',
        },
        status: 'error',
        error_node_id: null,
        error_code: 'duplicate_record_key',
      },
    ],
    next_cursor: null,
  },
  NewExecutionConfirmOverlap: {
    revision: 5,
    parameters: {
      meta_minima: '100.00',
    },
    confirm_overlap: true,
  },
  ScopeAlreadyDelivered: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este escopo já foi entregue ou está em execução. Confirme para executar de novo: a entrega sai com uma revisão nova.',
    code: 'scope_already_delivered',
    overlapping: [
      {
        id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c12',
        status: 'completed',
        created_at: '2026-11-01T05:00:00Z',
        finished_at: '2026-11-01T05:09:30Z',
        triggered_by: null,
        schedule: {
          id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03',
          name: 'Fechamento mensal',
        },
      },
      {
        id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01',
        status: 'completed',
        created_at: '2026-10-21T12:00:00Z',
        finished_at: '2026-10-21T12:00:05Z',
        triggered_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        schedule: null,
      },
    ],
  },
  NotAwaitingDecision: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Esta execução não está aguardando decisão.',
    code: 'not_awaiting_decision',
  },
  ComparisonNotAvailable: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'Esta execução não tem comparação com um arquivo de referência.',
    code: 'comparison_not_available',
  },
  InvalidDataOutcome: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      outcome: 'Use um resultado de comparação válido.',
    },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataWorkflowId: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      workflow_id: 'Informe um identificador válido.',
    },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataSearch: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      search: 'Use até 100 caracteres.',
    },
  } satisfies Schemas['InvalidDataProblem'],
  InvalidDataUnreadOnly: {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    detail: 'Alguns dados enviados estão inválidos. Confira os campos e tente de novo.',
    code: 'invalid_data',
    fields: {
      unread_only: 'Use true ou false.',
    },
  } satisfies Schemas['InvalidDataProblem'],
  ExecutionPreValidating: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c09',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'pre_validating',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T14:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T14:00:00Z',
    started_at: '2026-11-24T14:00:01Z',
    data_read_at: '2026-11-24T14:00:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionAwaitingDecision: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c10',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'awaiting_decision',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T14:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T14:30:00Z',
    started_at: '2026-11-24T14:30:01Z',
    data_read_at: '2026-11-24T14:30:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 10,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'alerted',
      records: 9,
      empty_rows: 1,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [
        {
          variable: 'cod_prod',
          empty: 2,
          percent: '22.22',
          alert: true,
        },
      ],
      alert_percent: '1',
      decision: null,
      decision_expires_at: '2026-11-25T14:30:04Z',
    },
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionProceeded: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c10',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'calculating',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T14:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T14:30:00Z',
    started_at: '2026-11-24T14:30:01Z',
    data_read_at: '2026-11-24T14:30:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 10,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'alerted',
      records: 9,
      empty_rows: 1,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [
        {
          variable: 'cod_prod',
          empty: 2,
          percent: '22.22',
          alert: true,
        },
      ],
      alert_percent: '1',
      decision: {
        choice: 'proceed',
        by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        at: '2026-11-24T14:32:00Z',
      },
      decision_expires_at: '2026-11-25T14:30:04Z',
    },
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionDecisionCancelled: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c10',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'cancelled',
    abort_reason: null,
    cancel_requested_at: '2026-11-24T14:33:00Z',
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T14:30:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T14:30:00Z',
    started_at: '2026-11-24T14:30:01Z',
    data_read_at: '2026-11-24T14:30:02Z',
    finished_at: '2026-11-24T14:33:00Z',
    next_retry_at: null,
    total_records: 10,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'alerted',
      records: 9,
      empty_rows: 1,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [
        {
          variable: 'cod_prod',
          empty: 2,
          percent: '22.22',
          alert: true,
        },
      ],
      alert_percent: '1',
      decision: {
        choice: 'cancel',
        by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        at: '2026-11-24T14:33:00Z',
      },
      decision_expires_at: '2026-11-25T14:30:04Z',
    },
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionBlocked: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c11',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'aborted',
    abort_reason: {
      code: 'duplicate_record_key',
      message: 'A chave do registro se repete no lote. Nada foi calculado: corrija a origem ou a chave do registro.',
    },
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T15:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T15:00:00Z',
    started_at: '2026-11-24T15:00:01Z',
    data_read_at: '2026-11-24T15:00:02Z',
    finished_at: '2026-11-24T15:00:09Z',
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'blocked',
      records: 1200,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 2,
        examples: [
          {
            nf_id: '11',
            item_seq: '1',
          },
          {
            nf_id: '15',
            item_seq: '2',
          },
        ],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionScheduled: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c12',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'batch',
    status: 'completed',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-01T05:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: null,
    schedule: {
      id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03',
      name: 'Fechamento mensal',
    },
    created_at: '2026-11-01T05:00:12Z',
    started_at: '2026-11-01T05:00:13Z',
    data_read_at: '2026-11-01T05:00:14Z',
    finished_at: '2026-11-01T05:09:30Z',
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 2,
      records_done: 1200,
    },
    totals: {
      read: 1200,
      ok: 1150,
      ok_with_warnings: 50,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: true,
      expires_at: '2026-11-08T05:09:30Z',
      rows: 1200,
    },
    pre_validation: {
      status: 'alerted',
      records: 1200,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [
        {
          variable: 'cod_prod',
          empty: 30,
          percent: '2.50',
          alert: true,
        },
      ],
      alert_percent: '1',
      decision: {
        choice: 'automatic',
        by: null,
        at: '2026-11-01T05:01:02Z',
      },
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1150,
        no_match: 50,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 1200,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: null,
    comparison: null,
  },
  ExecutionSimulationPending: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c13',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'simulation',
    status: 'pending',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T16:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T16:00:00Z',
    started_at: null,
    data_read_at: null,
    finished_at: null,
    next_retry_at: null,
    total_records: null,
    progress: {
      chunks_done: 0,
      records_done: 0,
    },
    totals: {
      read: 0,
      ok: 0,
      ok_with_warnings: 0,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: {
      id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
      name: 'esperado-outubro.csv',
    },
    comparison: null,
  },
  ExecutionComparing: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c14',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'simulation',
    status: 'comparing',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T16:10:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T16:10:00Z',
    started_at: '2026-11-24T16:10:01Z',
    data_read_at: '2026-11-24T16:10:02Z',
    finished_at: null,
    next_retry_at: null,
    total_records: 2,
    progress: {
      chunks_done: 1,
      records_done: 2,
    },
    totals: {
      read: 2,
      ok: 1,
      ok_with_warnings: 1,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 2,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1,
        no_match: 1,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 2,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: {
      id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
      name: 'esperado-outubro.csv',
    },
    comparison: null,
  },
  ExecutionSimulationEqual: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c14',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'simulation',
    status: 'completed',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T16:10:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T16:10:00Z',
    started_at: '2026-11-24T16:10:01Z',
    data_read_at: '2026-11-24T16:10:02Z',
    finished_at: '2026-11-24T16:10:06Z',
    next_retry_at: null,
    total_records: 2,
    progress: {
      chunks_done: 1,
      records_done: 2,
    },
    totals: {
      read: 2,
      ok: 1,
      ok_with_warnings: 1,
      error: 0,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 2,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1,
        no_match: 1,
        multiple_rows: 0,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 2,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: {
      id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
      name: 'esperado-outubro.csv',
    },
    comparison: {
      compared: 2,
      equal: 2,
      different: 0,
      status_differs: 0,
      missing_from_result: 0,
      missing_from_file: 0,
      not_compared: 0,
      equal_percent: '100.00',
    },
  },
  ExecutionSimulationDivergent: {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c15',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    mode: 'simulation',
    status: 'completed_with_errors',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: {
      periodo: {
        start: '2026-10-01',
        end: '2026-10-31',
      },
      categorias: [
        'A',
        'B',
      ],
      meta_minima: '100.00',
    },
    now: '2026-11-24T17:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    schedule: null,
    created_at: '2026-11-24T17:00:00Z',
    started_at: '2026-11-24T17:00:01Z',
    data_read_at: '2026-11-24T17:00:02Z',
    finished_at: '2026-11-24T17:09:40Z',
    next_retry_at: null,
    total_records: 1200,
    progress: {
      chunks_done: 2,
      records_done: 1200,
    },
    totals: {
      read: 1200,
      ok: 1150,
      ok_with_warnings: 40,
      error: 10,
      ignored: 0,
      filtered: 0,
    },
    error_groups: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        code: 'multiple_rows',
        count: 10,
      },
    ],
    output: {
      available: false,
      expires_at: null,
      rows: null,
    },
    pre_validation: {
      status: 'passed',
      records: 1200,
      empty_rows: 0,
      null_key_records: 0,
      duplicate_keys: {
        count: 0,
        examples: [],
      },
      empty_values: [],
      alert_percent: '1',
      decision: null,
      decision_expires_at: null,
    },
    source_counts: [
      {
        node_id: 'produto',
        node_name: 'Produto',
        mode: 'linear',
        found: 1150,
        no_match: 40,
        multiple_rows: 10,
        kept: null,
        filtered: null,
      },
      {
        node_id: 'campanha',
        node_name: 'Produtos da campanha',
        mode: 'filter',
        found: null,
        no_match: null,
        multiple_rows: null,
        kept: 1190,
        filtered: 0,
      },
    ],
    overlap_of: null,
    reference_file: {
      id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
      name: 'esperado-outubro.csv',
    },
    comparison: {
      compared: 1194,
      equal: 1182,
      different: 6,
      status_differs: 3,
      missing_from_result: 1,
      missing_from_file: 2,
      not_compared: 7,
      equal_percent: '98.99',
    },
  },
  ComparisonRecordList: {
    items: [
      {
        result_key: '3a1340afb3a61f11f38860492e8829ce0fd8b1cba0c7eb44e1820912a3e2d482',
        record_key: {
          nf_id: '10',
          item_seq: '1',
        },
        outcome: 'different',
        expected_status: null,
        obtained_status: 'ok',
        fields: [
          {
            name: 'pontos',
            expected: '230.00',
            obtained: '225.00',
          },
        ],
      },
      {
        result_key: '0ae47b7fb851a06a5219fe997f22d58af265de01202de00969906123084ad19b',
        record_key: {
          nf_id: '10',
          item_seq: '2',
        },
        outcome: 'status_differs',
        expected_status: 'ok',
        obtained_status: 'error',
        fields: [],
      },
      {
        result_key: '5f0c2b8e6d4a1937c8e2b6a0d4f19e3c7b5a2d8e0f6c4a1b9d3e7f2a6c8b0d14',
        record_key: {
          nf_id: '12',
          item_seq: '1',
        },
        outcome: 'missing_from_result',
        expected_status: null,
        obtained_status: null,
        fields: [],
      },
      {
        result_key: '9b4e7d2a0c6f3815e9a7c4b2d0f6e1a3c5b8d7e9f0a2c4b6d8e1f3a5c7b9d2e4',
        record_key: {
          nf_id: '13',
          item_seq: '1',
        },
        outcome: 'missing_from_file',
        expected_status: null,
        obtained_status: 'ok_with_warnings',
        fields: [],
      },
    ],
    next_cursor: 'eyJvZmZzZXQiOjR9',
  },
  NewSchedule: {
    revision: 5,
    name: 'Fechamento mensal',
    enabled: true,
    recurrence: {
      kind: 'monthly',
      time: '02:00',
      day: 1,
    },
    parameters: {
      periodo: {
        kind: 'relative',
        value: 'previous_month',
      },
      meta_minima: {
        kind: 'fixed',
        value: '100.00',
      },
    },
  },
  ScheduleMonthly: {
    id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    name: 'Fechamento mensal',
    enabled: true,
    recurrence: {
      kind: 'monthly',
      time: '02:00',
      day: 1,
    },
    timezone: 'America/Sao_Paulo',
    parameters: {
      periodo: {
        kind: 'relative',
        value: 'previous_month',
      },
      meta_minima: {
        kind: 'fixed',
        value: '100.00',
      },
    },
    draft_revision: 5,
    current_draft_revision: 7,
    next_run_at: '2026-12-01T05:00:00Z',
    last_run: {
      scheduled_for: '2026-11-01T05:00:00Z',
      fired_at: '2026-11-01T05:00:12Z',
      outcome: 'triggered',
      execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c12',
      message: null,
    },
    created_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    created_at: '2026-10-20T13:00:00Z',
    updated_at: '2026-10-20T13:00:00Z',
  },
  ScheduleDaily: {
    id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e01',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    name: 'Prévia diária',
    enabled: true,
    recurrence: {
      kind: 'daily',
      time: '06:30',
    },
    timezone: 'America/Sao_Paulo',
    parameters: {
      periodo: {
        kind: 'relative',
        value: 'current_month',
      },
      meta_minima: {
        kind: 'fixed',
        value: '100.00',
      },
    },
    draft_revision: 7,
    current_draft_revision: 7,
    next_run_at: '2026-11-25T09:30:00Z',
    last_run: null,
    created_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    created_at: '2026-11-24T18:00:00Z',
    updated_at: '2026-11-24T18:00:00Z',
  },
  ScheduleWeekly: {
    id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e02',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    workflow_name: 'Pontuação de exemplo',
    name: 'Conferência semanal',
    enabled: false,
    recurrence: {
      kind: 'weekly',
      time: '22:00',
      weekdays: [
        1,
        4,
      ],
    },
    timezone: 'America/Sao_Paulo',
    parameters: {
      periodo: {
        kind: 'relative',
        value: 'last_7_days',
      },
    },
    draft_revision: 6,
    current_draft_revision: 7,
    next_run_at: null,
    last_run: {
      scheduled_for: '2026-11-21T01:00:00Z',
      fired_at: '2026-11-21T01:00:05Z',
      outcome: 'failed',
      execution_id: null,
      message: 'O parâmetro meta_minima é obrigatório e ficou sem valor.',
    },
    created_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    created_at: '2026-11-10T12:00:00Z',
    updated_at: '2026-11-21T12:00:00Z',
  },
  ScheduleList: {
    items: [
      {
        id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e02',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        workflow_name: 'Pontuação de exemplo',
        name: 'Conferência semanal',
        enabled: false,
        recurrence: {
          kind: 'weekly',
          time: '22:00',
          weekdays: [
            1,
            4,
          ],
        },
        timezone: 'America/Sao_Paulo',
        parameters: {
          periodo: {
            kind: 'relative',
            value: 'last_7_days',
          },
        },
        draft_revision: 6,
        current_draft_revision: 7,
        next_run_at: null,
        last_run: {
          scheduled_for: '2026-11-21T01:00:00Z',
          fired_at: '2026-11-21T01:00:05Z',
          outcome: 'failed',
          execution_id: null,
          message: 'O parâmetro meta_minima é obrigatório e ficou sem valor.',
        },
        created_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        created_at: '2026-11-10T12:00:00Z',
        updated_at: '2026-11-21T12:00:00Z',
      },
      {
        id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        workflow_name: 'Pontuação de exemplo',
        name: 'Fechamento mensal',
        enabled: true,
        recurrence: {
          kind: 'monthly',
          time: '02:00',
          day: 1,
        },
        timezone: 'America/Sao_Paulo',
        parameters: {
          periodo: {
            kind: 'relative',
            value: 'previous_month',
          },
          meta_minima: {
            kind: 'fixed',
            value: '100.00',
          },
        },
        draft_revision: 5,
        current_draft_revision: 7,
        next_run_at: '2026-12-01T05:00:00Z',
        last_run: {
          scheduled_for: '2026-11-01T05:00:00Z',
          fired_at: '2026-11-01T05:00:12Z',
          outcome: 'triggered',
          execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c12',
          message: null,
        },
        created_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        created_at: '2026-10-20T13:00:00Z',
        updated_at: '2026-10-20T13:00:00Z',
      },
      {
        id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e01',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        workflow_name: 'Pontuação de exemplo',
        name: 'Prévia diária',
        enabled: true,
        recurrence: {
          kind: 'daily',
          time: '06:30',
        },
        timezone: 'America/Sao_Paulo',
        parameters: {
          periodo: {
            kind: 'relative',
            value: 'current_month',
          },
          meta_minima: {
            kind: 'fixed',
            value: '100.00',
          },
        },
        draft_revision: 7,
        current_draft_revision: 7,
        next_run_at: '2026-11-25T09:30:00Z',
        last_run: null,
        created_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        created_at: '2026-11-24T18:00:00Z',
        updated_at: '2026-11-24T18:00:00Z',
      },
    ],
    next_cursor: null,
  },
  ScheduleNameTaken: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Já existe um agendamento com esse nome neste workflow.',
    code: 'schedule_name_taken',
  },
  TooManySchedules: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow já tem 20 agendamentos.',
    code: 'too_many_schedules',
  },
  ScheduleNoBatchSource: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow não tem fonte do lote. Escolha a fonte do lote para agendar a execução.',
    code: 'no_batch_source',
  },
  ReferenceFile: {
    id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    name: 'esperado-outubro.csv',
    size_bytes: 152,
    sha256: '6f1e3a5c7b9d2e4f6a8c0b2d4e6f8a1c3e5b7d9f0a2c4e6b8d1f3a5c7e9b0d2f',
    records: 2,
    key_columns: [
      'nf_id',
      'item_seq',
    ],
    field_columns: [
      'pontos',
      'elegivel',
    ],
    has_status: true,
    uploaded_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    uploaded_at: '2026-11-24T15:50:00Z',
    last_comparison: {
      execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c14',
      status: 'completed',
      equal_percent: '100.00',
      finished_at: '2026-11-24T16:10:06Z',
    },
  },
  ReferenceFileUploaded: {
    id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a02',
    workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
    name: 'esperado-novembro.csv',
    size_bytes: 98,
    sha256: '1a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c1e3b5d7f9a0c2e4b6d8f1a3c',
    records: 2,
    key_columns: [
      'nf_id',
      'item_seq',
    ],
    field_columns: [
      'pontos',
    ],
    has_status: false,
    uploaded_by: {
      id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
      name: 'Ana Souza',
    },
    uploaded_at: '2026-11-24T18:10:00Z',
    last_comparison: null,
  },
  ReferenceFileList: {
    items: [
      {
        id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a02',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        name: 'esperado-novembro.csv',
        size_bytes: 98,
        sha256: '1a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c1e3b5d7f9a0c2e4b6d8f1a3c',
        records: 2,
        key_columns: [
          'nf_id',
          'item_seq',
        ],
        field_columns: [
          'pontos',
        ],
        has_status: false,
        uploaded_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        uploaded_at: '2026-11-24T18:10:00Z',
        last_comparison: null,
      },
      {
        id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
        workflow_id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
        name: 'esperado-outubro.csv',
        size_bytes: 152,
        sha256: '6f1e3a5c7b9d2e4f6a8c0b2d4e6f8a1c3e5b7d9f0a2c4e6b8d1f3a5c7e9b0d2f',
        records: 2,
        key_columns: [
          'nf_id',
          'item_seq',
        ],
        field_columns: [
          'pontos',
          'elegivel',
        ],
        has_status: true,
        uploaded_by: {
          id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
          name: 'Ana Souza',
        },
        uploaded_at: '2026-11-24T15:50:00Z',
        last_comparison: {
          execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c14',
          status: 'completed',
          equal_percent: '100.00',
          finished_at: '2026-11-24T16:10:06Z',
        },
      },
    ],
  },
  ReferenceFileNoBatchSource: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow não tem fonte do lote. Escolha a fonte do lote para enviar um arquivo de referência.',
    code: 'no_batch_source',
  },
  TooManyReferenceFiles: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow já tem 20 arquivos de referência.',
    code: 'too_many_reference_files',
  },
  InvalidReferenceFile: {
    type: 'about:blank',
    title: 'Arquivo de referência inválido',
    status: 422,
    detail: 'O arquivo de referência tem erros. Corrija-os e envie de novo.',
    code: 'invalid_reference_file',
    fields: {
      'linha 12, coluna pontos': 'Use número com ponto, como 225.00.',
      'linha 15, coluna item_seq': 'Preencha todas as partes da chave do registro.',
      'linha 21, coluna nf_id': 'Chave repetida no arquivo: já apareceu na linha 9.',
    },
  },
  InvalidReferenceFileHeader: {
    type: 'about:blank',
    title: 'Arquivo de referência inválido',
    status: 422,
    detail: 'O arquivo de referência tem erros. Corrija-os e envie de novo.',
    code: 'invalid_reference_file',
    fields: {
      header: 'A coluna "observacao" não é da chave do registro nem um campo da saída.',
    },
  },
  ReferenceFileMismatch: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'As colunas do arquivo não batem mais com o workflow. Envie o arquivo de novo.',
    code: 'reference_file_mismatch',
  },
  NewSimulation: {
    revision: 5,
    parameters: {
      meta_minima: '100.00',
    },
  },
  AllowedValues: {
    values: [
      'PE',
      'RS',
      'SP',
    ],
    truncated: false,
  },
  AllowedValuesTruncated: {
    values: [
      'C0001',
      'C0002',
      'C0003',
    ],
    truncated: true,
  },
  ParameterNotFound: {
    type: 'about:blank',
    title: 'Não encontrado',
    status: 404,
    detail: 'Este workflow não tem parâmetro com esse nome.',
    code: 'parameter_not_found',
  },
  AllowedValuesNotQuery: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Os valores permitidos deste parâmetro não vêm de uma consulta a um dataset.',
    code: 'allowed_values_not_query',
  },
  AllowedValuesDraftHasProblems: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Corrija os problemas do rascunho e tente de novo.',
    code: 'draft_has_problems',
    problems: [
      {
        code: 'allowed_values_type_mismatch',
        message: 'A variável dos valores permitidos de uf não é do tipo texto.',
        path: 'parameters[0].allowed_values.variable_id',
        node_id: null,
        start: null,
        end: null,
        suggestion: null,
      },
    ],
  },
  AllowedValuesSchemaDrift: {
    type: 'about:blank',
    title: 'Origem mudou',
    status: 422,
    detail: 'Uma coluna da consulta dos valores permitidos mudou ou não existe mais na origem.',
    code: 'schema_drift',
  },
  AllowedValuesSourceReadDenied: {
    type: 'about:blank',
    title: 'Sem permissão de leitura',
    status: 422,
    detail: 'O usuário da conexão não pode ler o dataset dos valores permitidos. Peça a permissão de leitura (SELECT) a quem cuida do banco.',
    code: 'source_read_denied',
  },
  WorkflowHasSchedules: {
    type: 'about:blank',
    title: 'Conflito',
    status: 409,
    detail: 'Este workflow tem agendamentos. Apague-os antes de apagar o workflow.',
    code: 'workflow_has_schedules',
  },
  NotificationList: {
    items: [
      {
        id: '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b01',
        kind: 'awaiting_decision',
        title: 'Execução aguarda decisão',
        detail: 'Pontuação de exemplo: a pré-validação encontrou campos vazios acima do limite. Prossiga ou cancele na execução.',
        created_at: '2026-11-24T14:30:04Z',
        read: false,
        workflow: {
          id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
          name: 'Pontuação de exemplo',
        },
        execution: {
          id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c10',
        },
        schedule: null,
      },
      {
        id: '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b02',
        kind: 'schedule_failed',
        title: 'Agendamento não disparou',
        detail: 'Conferência semanal (Pontuação de exemplo): o parâmetro meta_minima é obrigatório e ficou sem valor.',
        created_at: '2026-11-21T01:00:05Z',
        read: false,
        workflow: {
          id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
          name: 'Pontuação de exemplo',
        },
        execution: null,
        schedule: {
          id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e02',
          name: 'Conferência semanal',
        },
      },
      {
        id: '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b03',
        kind: 'pre_validation_alert',
        title: 'Alerta na pré-validação',
        detail: 'Pontuação de exemplo: a execução agendada seguiu com campos vazios acima do limite (cod_prod).',
        created_at: '2026-11-01T05:01:02Z',
        read: true,
        workflow: {
          id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70',
          name: 'Pontuação de exemplo',
        },
        execution: {
          id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c12',
        },
        schedule: {
          id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03',
          name: 'Fechamento mensal',
        },
      },
    ],
    next_cursor: 'eyJjcmVhdGVkX2F0IjoiMjAyNi0xMS0wMVQwNTowMTowMloifQ',
    unread_count: 2,
  },
  ReadNotificationIds: {
    ids: [
      '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b01',
      '0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b02',
    ],
  },
  ReadAllNotifications: {
    all: true,
  },
  DraftUpdateWithAllowedValuesQuery: {
    revision: 7,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: {
          scale: 2,
          mode: 'half_up',
        },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters: [
        {
          name: 'campanha',
          type: 'text',
          required: true,
          list: false,
          scale: null,
          default: null,
          allowed_values: {
            dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c09',
            variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e91',
            filters: [
              {
                variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e92',
                operator: '=',
                values: [
                  'verdadeiro',
                ],
              },
            ],
          },
          description: 'Código da campanha',
        },
      ],
      root: {
        inputs: [],
        nodes: [],
        output: {
          fields: [],
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export const EXAMPLES = EXAMPLES_BASE;

export type ExampleName = keyof typeof EXAMPLES;

/**
 * LEGACY FORM, not a contract example (it stays out of EXAMPLES, which `contract-examples.spec.ts` compares exactly with the
 * contract). The real API served the reference campaign with `settings` lacking `error_limit_percent` and `trace_level`
 * (D44 of the front), whatever the schema says; the editor reads their defaults and the first save writes both. The cast is
 * the only way to hold a value the generated type forbids.
 */
/**
 * The `Draft` example's definition as the generated type. The contract example has no `root.batch_source` (the schema
 * requires it, nullable), so the cast goes through `unknown`; `contract-examples.spec.ts` keeps the example equal to the contract.
 */
export const EXAMPLE_DRAFT_DEFINITION = EXAMPLES_BASE.Draft.definition as unknown as Schemas['WorkflowDefinition'];

export const LEGACY_SETTINGS = {
  error_policy: 'error',
  rounding: { scale: 2, mode: 'half_up' },
} as unknown as Schemas['WorkflowDefinition']['settings'];
