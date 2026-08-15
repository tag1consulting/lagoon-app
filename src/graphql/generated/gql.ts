/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query ProjectByName($name: String!) {\n  projectByName(name: $name) {\n    id\n    name\n    gitUrl\n    productionEnvironment\n    environments {\n      id\n      name\n      deployType\n      environmentType\n      route\n      updated\n    }\n  }\n}\n\nquery EnvironmentInfo($name: String!, $project: Int!) {\n  environmentByName(name: $name, project: $project) {\n    id\n    name\n    deployType\n    deployBaseRef\n    environmentType\n    openshiftProjectName\n    created\n    updated\n    route\n    routes\n    services {\n      id\n      name\n      type\n      replicas\n      updated\n    }\n    facts(keyFacts: true, limit: 100) {\n      id\n      name\n      value\n      source\n      category\n      service\n    }\n  }\n}": typeof types.ProjectByNameDocument,
    "query Me {\n  me {\n    id\n    email\n    firstName\n    lastName\n  }\n}\n\nquery LagoonVersion {\n  lagoonVersion\n}\n\nquery AllProjects {\n  allProjects {\n    id\n    name\n    environments {\n      id\n      name\n      environmentType\n      updated\n    }\n  }\n}": typeof types.MeDocument,
};
const documents: Documents = {
    "query ProjectByName($name: String!) {\n  projectByName(name: $name) {\n    id\n    name\n    gitUrl\n    productionEnvironment\n    environments {\n      id\n      name\n      deployType\n      environmentType\n      route\n      updated\n    }\n  }\n}\n\nquery EnvironmentInfo($name: String!, $project: Int!) {\n  environmentByName(name: $name, project: $project) {\n    id\n    name\n    deployType\n    deployBaseRef\n    environmentType\n    openshiftProjectName\n    created\n    updated\n    route\n    routes\n    services {\n      id\n      name\n      type\n      replicas\n      updated\n    }\n    facts(keyFacts: true, limit: 100) {\n      id\n      name\n      value\n      source\n      category\n      service\n    }\n  }\n}": types.ProjectByNameDocument,
    "query Me {\n  me {\n    id\n    email\n    firstName\n    lastName\n  }\n}\n\nquery LagoonVersion {\n  lagoonVersion\n}\n\nquery AllProjects {\n  allProjects {\n    id\n    name\n    environments {\n      id\n      name\n      environmentType\n      updated\n    }\n  }\n}": types.MeDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query ProjectByName($name: String!) {\n  projectByName(name: $name) {\n    id\n    name\n    gitUrl\n    productionEnvironment\n    environments {\n      id\n      name\n      deployType\n      environmentType\n      route\n      updated\n    }\n  }\n}\n\nquery EnvironmentInfo($name: String!, $project: Int!) {\n  environmentByName(name: $name, project: $project) {\n    id\n    name\n    deployType\n    deployBaseRef\n    environmentType\n    openshiftProjectName\n    created\n    updated\n    route\n    routes\n    services {\n      id\n      name\n      type\n      replicas\n      updated\n    }\n    facts(keyFacts: true, limit: 100) {\n      id\n      name\n      value\n      source\n      category\n      service\n    }\n  }\n}"): (typeof documents)["query ProjectByName($name: String!) {\n  projectByName(name: $name) {\n    id\n    name\n    gitUrl\n    productionEnvironment\n    environments {\n      id\n      name\n      deployType\n      environmentType\n      route\n      updated\n    }\n  }\n}\n\nquery EnvironmentInfo($name: String!, $project: Int!) {\n  environmentByName(name: $name, project: $project) {\n    id\n    name\n    deployType\n    deployBaseRef\n    environmentType\n    openshiftProjectName\n    created\n    updated\n    route\n    routes\n    services {\n      id\n      name\n      type\n      replicas\n      updated\n    }\n    facts(keyFacts: true, limit: 100) {\n      id\n      name\n      value\n      source\n      category\n      service\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    id\n    email\n    firstName\n    lastName\n  }\n}\n\nquery LagoonVersion {\n  lagoonVersion\n}\n\nquery AllProjects {\n  allProjects {\n    id\n    name\n    environments {\n      id\n      name\n      environmentType\n      updated\n    }\n  }\n}"): (typeof documents)["query Me {\n  me {\n    id\n    email\n    firstName\n    lastName\n  }\n}\n\nquery LagoonVersion {\n  lagoonVersion\n}\n\nquery AllProjects {\n  allProjects {\n    id\n    name\n    environments {\n      id\n      name\n      environmentType\n      updated\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;