import _ from 'lodash';
import type { Writable } from 'stream';
import { inspect } from 'util';

import {
    Type, Static,
    TSchema, TString, TNumber, TInteger, TBoolean, TObject, TPartial, TOptional, TAny, TNull, TUndefined, TNever, TVoid, TUnknown, TLiteral, TLiteralValue, TProperties, TArray, TUnion, TPromise, TFunction, TPick, TOmit, TRecursive, TSelf, TRecord, TRecordKey, TTuple,
    StringOptions, NumericOptions, ObjectOptions, SchemaOptions, ArrayOptions, TUnsafe, UnsafeOptions
} from '@sinclair/typebox';
import { TypeCompiler, TypeCheck } from '@sinclair/typebox/compiler';
import { TypeSystem } from '@sinclair/typebox/system';

export type FluentStatic<T extends FluentTypeBuilderBase<TSchema> | FluentTypeCheck<TSchema> | TransformedFluentTypeCheck<TSchema>> =
    T extends TransformedFluentTypeCheck<TSchema, infer TT> ? TT
    : T extends FluentTypeCheck<infer TT> ? Static<TT>
    : T extends FluentTypeBuilderBase<infer TT> ? Static<TT>
    : unknown;

// export type FluentStatic<T extends FluentTypeBuilderBase<TSchema>> = T extends FluentTypeBuilderBase<infer TT> ? Static<TT> : unknown;
// export type FluentTypeCheckStatic<T extends FluentTypeCheck<TSchema>> = T extends FluentTypeCheck<infer TT> ? Static<TT> : unknown;
// export type TransformedFluentTypeCheckStatic<T extends TransformedFluentTypeCheck<TSchema>> = T extends TransformedFluentTypeCheck<TSchema, infer TT> ? TT : unknown;

export interface FluentTypeObject {
    [key: string]: FluentTypeBuilderBase<TSchema>;
}
export type MappedFluentTypeObjectProperties<T extends FluentTypeObject> = {
    [P in keyof T]: ReturnType<T[P]['schema']>;
}
export type MappedFluentTypeTuple<T extends [...any[]]> = {
    [P in keyof T]: ReturnType<T[P]['schema']>;
}
export type MappedWrapped<T extends FluentTypeBuilderBase<TSchema>> = ReturnType<T['schema']>

export class FluentTypeBuilder {
    public string(options?: StringOptions<string>) {
        return new StringFluentTypeBuilder(Type.String(options));
    }
    public number(options?: NumericOptions) {
        return new NumberFluentTypeBuilder(Type.Number(options));
    }
    public integer(options?: NumericOptions) {
        return new IntegerFluentTypeBuilder(Type.Integer(options));
    }
    public boolean(options?: SchemaOptions) {
        return new BooleanFluentTypeBuilder(Type.Boolean(options));
    }
    public literal<T extends TLiteralValue>(value: T, options?: SchemaOptions) {
        return new LiteralFluentTypeBuilder(Type.Literal(value, options));
    }
    public any(options?: SchemaOptions) {
        return new AnyFluentTypeBuilder(Type.Any(options));
    }
    public null(options?: SchemaOptions) {
        return new NullFluentTypeBuilder(Type.Null(options));
    }
    public undefined(options?: SchemaOptions) {
        return new UndefinedFluentTypeBuilder(Type.Undefined(options));
    }
    public never(options?: SchemaOptions) {
        return new NeverFluentTypeBuilder(Type.Never(options));
    }
    public void(options?: SchemaOptions) {
        return new VoidFluentTypeBuilder(Type.Void(options));
    }
    public unknown(options?: SchemaOptions) {
        return new UnknownFluentTypeBuilder(Type.Unknown(options));
    }
    public union<T extends FluentTypeBuilderBase<TSchema>[]>(schemas: [...T], options?: SchemaOptions) {
        return new UnionFluentTypeBuilder(Type.Union([...schemas.map(s => s.schema()) as MappedFluentTypeTuple<T>], options));
    }
    public object<T extends FluentTypeObject>(properties: T, options?: ObjectOptions) {
        const transformedProperties = _.transform(properties, (result, value, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedFluentTypeObjectProperties<T>);

        return new ObjectFluentTypeBuilder(Type.Object(transformedProperties, options), properties);
    }
    public array<T extends FluentTypeBuilderBase<TSchema>>(schema: T, options?: ArrayOptions) {
        return new ArrayFluentTypeBuilder(Type.Array(schema.schema(), options)) as (T extends FluentTypeBuilderBase<infer TItem> ? ArrayFluentTypeBuilder<TItem> : ArrayFluentTypeBuilder<TSchema>);
    }
    public function<T extends FluentTypeBuilderBase<TSchema>[], U extends FluentTypeBuilderBase<TSchema>>(parameters: [...T], returns: U) {
        return new FunctionFluentTypeBuilder(Type.Function([...parameters.map(p => p.schema()) as MappedFluentTypeTuple<T>], returns.schema())) as (U extends FluentTypeBuilderBase<infer TItem> ? FunctionFluentTypeBuilder<MappedFluentTypeTuple<T>, TItem> : FunctionFluentTypeBuilder<MappedFluentTypeTuple<T>, TSchema>);
    }
    public recursive<T extends TSchema>(callback: (self: SelfFluentTypeBuilder) => FluentTypeBuilderBase<T>, options?: SchemaOptions) {
        return new RecursiveFluentTypeBuilder(Type.Recursive((self) => {
            return callback(new SelfFluentTypeBuilder(self)).schema();
        }, options));
    }
    public record<TKey extends StringFluentTypeBuilder<TString> | NumberFluentTypeBuilder, T extends FluentTypeBuilderBase<TSchema>>(key: TKey, value: T, options?: ObjectOptions) {
        return new RecordFluentTypeBuilder(Type.Record(key.schema() as MappedWrapped<TKey>, value.schema() as MappedWrapped<T>, options));
    }
    public type<T extends TSchema>(schema: T) {
        return new CustomFluentTypeBuilder(schema);
    }
    public promise<T extends FluentTypeBuilderBase<TSchema>>(schema: T, options?: SchemaOptions) {
        return new PromiseFluentTypeBuilder(Type.Promise(schema.schema(), options))
    }
    public unsafe<T>(options?: UnsafeOptions) {
        return new UnsafeFluentTypeBuilder(Type.Unsafe<T>(options));
    }
    public tuple<T extends FluentTypeBuilderBase<TSchema>[]>(items: [...T], options?: SchemaOptions) {
        return new TupleFluentTypeBuilder(Type.Tuple([...items.map(i => i.schema()) as MappedFluentTypeTuple<T>], options));
    }
}

export abstract class FluentTypeBuilderBase<T extends TSchema> {
    protected type: T;

    public constructor(type: T) {
        this.type = type;
    }

    public optional() {
        return new OptionalFluentTypeBuilder(Type.Optional(this.type));
    }
    public nullable(options?: SchemaOptions) {
        return new NullableFluentTypeBuilder(Type.Union([ Type.Null(), this.type ], options));
    }
    public array(options?: ArrayOptions) {
        return new ArrayFluentTypeBuilder(Type.Array(this.type, options));
    }
    public promised(options?: SchemaOptions) {
        return new PromiseFluentTypeBuilder(Type.Promise(this.type, options))
    }

    public schema() {
        return this.type;
    }

    public compile(): FluentTypeCheck<T>;
    public compile<TT>(transform: (value: Static<T>) => TT): TransformedFluentTypeCheck<T, TT>;
    public compile<TT>(transform?: (value: Static<T>) => TT): FluentTypeCheck<T> | TransformedFluentTypeCheck<T, TT> {
        if (transform)
            return new TransformedFluentTypeCheck(TypeCompiler.Compile(this.type), transform);
        else
            return new FluentTypeCheck(TypeCompiler.Compile(this.type));
    }
}
export class StringFluentTypeBuilder<T extends TString> extends FluentTypeBuilderBase<T> {
}
export class NumberFluentTypeBuilder extends FluentTypeBuilderBase<TNumber> {
}
export class IntegerFluentTypeBuilder extends FluentTypeBuilderBase<TInteger> {
}
export class BooleanFluentTypeBuilder extends FluentTypeBuilderBase<TBoolean> {
}
export class LiteralFluentTypeBuilder<T extends TLiteralValue> extends FluentTypeBuilderBase<TLiteral<T>> {
}
export class AnyFluentTypeBuilder extends FluentTypeBuilderBase<TAny> {
}
export class NullFluentTypeBuilder extends FluentTypeBuilderBase<TNull> {
}
export class UndefinedFluentTypeBuilder extends FluentTypeBuilderBase<TUndefined> {
}
export class NeverFluentTypeBuilder extends FluentTypeBuilderBase<TNever> {
}
export class VoidFluentTypeBuilder extends FluentTypeBuilderBase<TVoid> {
}
export class UnknownFluentTypeBuilder extends FluentTypeBuilderBase<TUnknown> {
}
export class UnionFluentTypeBuilder<T extends TSchema[]> extends FluentTypeBuilderBase<TUnion<T>> {
}
export class ObjectFluentTypeBuilder<T extends TObject, P extends FluentTypeObject> extends FluentTypeBuilderBase<T> {
    private properties: P;

    public constructor(schema: T, properties: P) {
        super(schema);

        this.properties = properties;
    }

    public partial(options?: ObjectOptions) {
        return new PartialFluentTypeBuilder(Type.Partial(this.type, options));
    }
    public extend<T extends FluentTypeObject>(properties: T, options?: SchemaOptions) {
        const transformedProperties = _.transform({ ...this.properties, ...properties }, (result, value, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedFluentTypeObjectProperties<P & T>);

        return new ObjectFluentTypeBuilder(Type.Object(transformedProperties, options), properties);
    }

    public pick<K extends keyof P>(keys: K, options?: SchemaOptions) {
        const pickedProperties = _.pick(this.properties, keys);
        const transformedProperties = _.transform(pickedProperties, (result, value: FluentTypeBuilderBase<TSchema>, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedFluentTypeObjectProperties<typeof pickedProperties>);

        return new ObjectFluentTypeBuilder(Type.Object(transformedProperties, options), pickedProperties);
    }
    public omit<K extends keyof P>(keys: K, options?: SchemaOptions) {
        const pickedProperties = _.omit(this.properties, keys);
        const transformedProperties = _.transform(pickedProperties, (result, value: FluentTypeBuilderBase<TSchema>, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedFluentTypeObjectProperties<typeof pickedProperties>);

        return new ObjectFluentTypeBuilder(Type.Object(transformedProperties, options), pickedProperties);
    }

    // public pick<K extends keyof P>(keys: (keyof T & string)[], options?: SchemaOptions) {
    //     // const t = keys.map(k => Type.Literal(k));
    //     const tmp = Type.Pick(this.schema(), Type.Union([ Type.Literal('test') ]), options);

    //     return new PickFluentTypeBuilder(tmp);
    // }
}
export class PartialFluentTypeBuilder<T extends TObject> extends FluentTypeBuilderBase<TPartial<T>> {
}
export class OptionalFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<TOptional<T>> {
}
export class NullableFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<TUnion<[ TNull, T ]>> {
}
export class ArrayFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<TArray<T>> {
}
export class PromiseFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<TPromise<T>> {
}
export class FunctionFluentTypeBuilder<T extends readonly TSchema[], U extends TSchema> extends FluentTypeBuilderBase<TFunction<T, U>> {
}
export class RecursiveFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<TRecursive<T>> {
}
export class SelfFluentTypeBuilder extends FluentTypeBuilderBase<TSelf> {
}
export class RecordFluentTypeBuilder<TKey extends TRecordKey, T extends TSchema> extends FluentTypeBuilderBase<TRecord<TKey, T>> {
}
export class CustomFluentTypeBuilder<T extends TSchema> extends FluentTypeBuilderBase<T> {
}
export class UnsafeFluentTypeBuilder<T> extends FluentTypeBuilderBase<TUnsafe<T>> {
}
export class TupleFluentTypeBuilder<T extends TSchema[]> extends FluentTypeBuilderBase<TTuple<T>> {
}

export class FluentTypeCheck<T extends TSchema> {
    protected typeCheck: TypeCheck<T>;

    public constructor(typeCheck: TypeCheck<T>) {
        this.typeCheck = typeCheck;
    }

    public check(value: unknown): value is Static<T, []> {
        return this.typeCheck.Check(value);
    }
    public parse(value: unknown) {
        if (!this.check(value))
            throw new FluentTypeCheckError('schema validation failed', this, value);

        return value;
    }
    public errors(value: unknown) {
        return this.typeCheck.Errors(value);
    }
}
export class TransformedFluentTypeCheck<T extends TSchema, TT = Static<T>> extends FluentTypeCheck<T> {
    private transform: (value: unknown) => TT;

    public constructor(typeCheck: TypeCheck<T>, transform: (value: Static<T>) => TT) {
        super(typeCheck)

        this.transform = transform;
    }

    public override parse(value: unknown) {
        if (!this.check(value))
            throw new FluentTypeCheckError('schema validation failed', this, value);

        return this.transform(value);
    }
}

export interface FluentTypeCheckErrorOptions extends ErrorOptions {
    // typeCheck: FluentTypeCheck<TSchema>;
    // value: unknown;
}
export class FluentTypeCheckError extends Error {
    public typeCheck: FluentTypeCheck<TSchema>;
    public value: unknown

    constructor(message: string, typeCheck: FluentTypeCheck<TSchema>, value: unknown, options?: FluentTypeCheckErrorOptions) {
        super(message, options);

        this.typeCheck = typeCheck;
        this.value = value;
    }

    public writeDetailedOutput(stdout: Writable) {
        stdout.write(inspect(this.value) + '\n');
        for (const valueError of this.typeCheck.errors(this.value))
            stdout.write(`[${valueError.path}] ${valueError.message} <${valueError.value}>` + '\n');
    }
}

// const Tmp = Type.Recursive(T => Type.Object({
//     name: Type.String(),
//     test: T
// }));
// const TmpCompiled = TypeCompiler.Compile(Tmp);

// const Tmp2 = Type.Array(Type.Object({
//     name: Type.String()
// }));
// const Tmp2Compiled = TypeCompiler.Compile(Tmp2);
// const test = {};
// if (Tmp2Compiled.Check(test)) {
//     for (const t of test) {
//     }
//     const t = test[0];

// }

// const FT = new FluentTypeBuilder();

// interface ITest {
//     name: string;
//     value: string;
// }
// const Test = FT.unsafe<ITest>().compile();
// const test = {};
// if (Test.check(test)) {
// }

// const Test = FT.object({
//     name: FT.string(),
//     abc: FT.literal('abc')
// }).compile(value => ({
//     ...value,
//     name2: value.name,
//     test: '123' as const
// }));

// type TTest = FluentStatic<typeof Test>;

// const test = {};
// const parsedTest = Test.parse(test);

// const Tmp = FT.tuple([ FT.string(), FT.number() ]).compile();
// const tmp = {};

// if (Tmp.check(tmp)) {
//     const t = tmp;
// }

// const Tmp2T = Type.Tuple([ Type.String(), Type.Number() ]);
// const Tmp2 = TypeCompiler.Compile(Tmp2T);
// if (Tmp2.Check(tmp)) {
//     const t = tmp;
// }
