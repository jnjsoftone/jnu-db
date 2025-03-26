export interface TableSchema {
    table_name: string;
    column_name: string;
    data_type: string;
    length?: number;
    precision?: number;
    scale?: number;
    is_nullable: boolean;
    is_primary: boolean;
    is_unique: boolean;
    is_foreign: boolean;
    foreign_table?: string;
    foreign_column?: string;
    default_value?: string;
    auto_increment: boolean;
    description: string;
    validation?: string;
    example?: string;
}
export interface DBConfig {
    pg: {
        host: string;
        user: string;
        password: string;
        database: string;
        port: number;
    };
    mysql: {
        host: string;
        user: string;
        password: string;
        database: string;
        port: number;
    };
    sqlite: {
        filename: string;
    };
}
export interface DbConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
//# sourceMappingURL=types.d.ts.map