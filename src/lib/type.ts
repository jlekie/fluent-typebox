import _ from 'lodash';

import { Type, TSchema, TString, TNumber, TInteger, TBoolean, TObject, TPartial, TOptional, TAny, TNull, TUndefined, TNever, TVoid, TUnknown, TLiteral, TLiteralValue, TProperties, TArray, TUnion, TPromise, TFunction, StringOptions, NumericOptions, ObjectOptions, SchemaOptions, ArrayOptions, Static } from '@sinclair/typebox';
import { TypeCompiler, ValueError, TypeCheck } from '@sinclair/typebox/compiler';

export interface WrappedObject {
    [key: string]: WrapperBase<TSchema>;
}
export type MappedWrappedObjectProperties<T extends WrappedObject> = {
    [P in keyof T]: ReturnType<T[P]['schema']>;
}
export type MappedWrappedTuple<T extends [...any[]]> = {
    [P in keyof T]: ReturnType<T[P]['schema']>;
}
export type MappedWrapped<T extends WrapperBase<TSchema>> = ReturnType<T['schema']>

export class RefactoredType {
    public string(options?: StringOptions<string>) {
        return new StringWrapper(Type.String(options));
    }
    public number(options?: NumericOptions) {
        return new NumberWrapper(Type.Number(options));
    }
    public integer(options?: NumericOptions) {
        return new IntegerWrapper(Type.Integer(options));
    }
    public boolean(options?: SchemaOptions) {
        return new BooleanWrapper(Type.Boolean(options));
    }
    public literal<T extends TLiteralValue>(value: T, options?: SchemaOptions) {
        return new LiteralWrapper(Type.Literal(value, options));
    }
    public any(options?: SchemaOptions) {
        return new AnyWrapper(Type.Any(options));
    }
    public null(options?: SchemaOptions) {
        return new NullWrapper(Type.Null(options));
    }
    public undefined(options?: SchemaOptions) {
        return new UndefinedWrapper(Type.Undefined(options));
    }
    public never(options?: SchemaOptions) {
        return new NeverWrapper(Type.Never(options));
    }
    public void(options?: SchemaOptions) {
        return new VoidWrapper(Type.Void(options));
    }
    public unknown(options?: SchemaOptions) {
        return new UnknownWrapper(Type.Unknown(options));
    }
    public union<T extends WrapperBase<TSchema>[]>(schemas: [...T], options?: SchemaOptions) {
        return new UnionWrapper(Type.Union([...schemas.map(s => s.schema()) as MappedWrappedTuple<T>], options));
    }
    public object<T extends WrappedObject>(properties: T, options?: ObjectOptions) {
        const transformedProperties = _.transform(properties, (result, value, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedWrappedObjectProperties<T>);

        return new ObjectWrapper(Type.Object(transformedProperties, options), properties);
    }
    public array<T extends WrapperBase<TSchema>>(schema: T, options?: ArrayOptions) {
        return new ArrayWrapper(Type.Array(schema.schema(), options)) as (T extends WrapperBase<infer TItem> ? ArrayWrapper<TItem> : ArrayWrapper<TSchema>);
    }
    public function<T extends WrapperBase<TSchema>[], U extends WrapperBase<TSchema>>(parameters: [...T], returns: U) {
        return new FunctionWrapper(Type.Function([...parameters.map(p => p.schema()) as MappedWrappedTuple<T>], returns.schema())) as (U extends WrapperBase<infer TItem> ? FunctionWrapper<MappedWrappedTuple<T>, TItem> : FunctionWrapper<MappedWrappedTuple<T>, TSchema>);
    }
    public type<T extends TSchema>(schema: T) {
        return new CustomWrapper(schema);
    }
}

export abstract class WrapperBase<T extends TSchema> {
    protected type: T;

    public constructor(type: T) {
        this.type = type;
    }

    public optional() {
        return new OptionalWrapper(Type.Optional(this.type));
    }
    public nullable(options?: SchemaOptions) {
        return new NullableWrapper(Type.Union([ Type.Null(), this.type ], options));
    }
    public array(options?: ArrayOptions) {
        return new ArrayWrapper(Type.Array(this.type, options));
    }
    public promised(options?: SchemaOptions) {
        return new PromiseWrapper(Type.Promise(this.type, options))
    }

    public schema() {
        return this.type;
    }
    public compile() {
        return new CompiledWrapper(TypeCompiler.Compile(this.type));
    }
}
export class StringWrapper<T extends TString> extends WrapperBase<T> {
}
export class NumberWrapper extends WrapperBase<TNumber> {
}
export class IntegerWrapper extends WrapperBase<TInteger> {
}
export class BooleanWrapper extends WrapperBase<TBoolean> {
}
export class LiteralWrapper<T extends TLiteralValue> extends WrapperBase<TLiteral<T>> {
}
export class AnyWrapper extends WrapperBase<TAny> {
}
export class NullWrapper extends WrapperBase<TNull> {
}
export class UndefinedWrapper extends WrapperBase<TUndefined> {
}
export class NeverWrapper extends WrapperBase<TNever> {
}
export class VoidWrapper extends WrapperBase<TVoid> {
}
export class UnknownWrapper extends WrapperBase<TUnknown> {
}
export class UnionWrapper<T extends TSchema[]> extends WrapperBase<TUnion<T>> {
}
export class ObjectWrapper<T extends TObject, P extends WrappedObject> extends WrapperBase<T> {
    private properties: P;

    public constructor(schema: T, properties: P) {
        super(schema);

        this.properties = properties;
    }

    public partial() {
        return new PartialWrapper(Type.Partial(this.type));
    }
    public extend<T extends WrappedObject>(properties: T) {
        const transformedProperties = _.transform({ ...this.properties, ...properties }, (result, value, key) => {
            (result as any)[key] = value.schema();
        }, {} as MappedWrappedObjectProperties<P & T>);

        return new ObjectWrapper(Type.Object(transformedProperties), properties)
    }
}
export class PartialWrapper<T extends TObject> extends WrapperBase<TPartial<T>> {
}
export class OptionalWrapper<T extends TSchema> extends WrapperBase<TOptional<T>> {
}
export class NullableWrapper<T extends TSchema> extends WrapperBase<TUnion<[ TNull, T ]>> {
}
export class ArrayWrapper<T extends TSchema> extends WrapperBase<TArray<T>> {
}
export class PromiseWrapper<T extends TSchema> extends WrapperBase<TPromise<T>> {
}
export class FunctionWrapper<T extends readonly TSchema[], U extends TSchema> extends WrapperBase<TFunction<T, U>> {
}
export class CustomWrapper<T extends TSchema> extends WrapperBase<T> {
}

export class CompiledWrapper<T extends TSchema> {
    private typeCheck: TypeCheck<T>;

    public constructor(typeCheck: TypeCheck<T>) {
        this.typeCheck = typeCheck;
    }

    public check(value: unknown): value is Static<T, []> {
        return this.typeCheck.Check(value);
    }
}

const RT = new RefactoredType();

const Tmp1 = RT.object({
    name: RT.string(),
    values: RT.string().array().optional(),
    test: RT.number().nullable(),
    test2: RT.union([ RT.string(), RT.number(), RT.boolean() ]),
    test3: RT.literal('abc'),
    test4: RT.array(RT.string().nullable())
});
const Tmp2 = Tmp1.extend({
    test5: RT.string(),
    test6: RT.string().promised(),
    test7: RT.function([ RT.string(), RT.boolean().optional() ], RT.number())
})

const Tmp3 = RT.function([ RT.string(), RT.boolean().optional() ], RT.number()).schema();

const Tmp = Tmp2.compile();

const test = {};
if (!Tmp.check(test))
    throw new Error();

const aaa = test.name;
test.test7('', false);
// test.test4
// console.log(aaa);
