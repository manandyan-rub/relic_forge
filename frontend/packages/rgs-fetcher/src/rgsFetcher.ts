import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

type Operation<Path extends keyof paths, Method extends 'get' | 'post'> = paths[Path] extends {
	[K in Method]?: infer TOperation;
}
	? TOperation
	: never;

type JsonResponse<TOperation> = TOperation extends {
	responses: {
		200: {
			content: {
				'application/json': infer TResponse;
			};
		};
	};
}
	? TResponse
	: unknown;

type JsonRequest<TOperation> = TOperation extends {
	requestBody: {
		content: {
			'application/json': infer TRequest extends object;
		};
	};
	}
	? TRequest
	: Record<string, unknown>;

type GetPath = keyof paths | `/bet/replay/${string}/${string}/${string}/${string}`;

type PathOperation<Path extends string, Method extends 'get' | 'post'> = Path extends keyof paths
	? Operation<Path, Method>
	: never;

/** rgs_url may arrive as a bare host or with a scheme; never double the scheme. */
const rgsBase = (rgsUrl: string) => {
	const value = (rgsUrl || '').trim().replace(/\/+$/, '');
	return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = JsonResponse<Operation<T, 'post'>>,
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: JsonRequest<Operation<T, 'post'>>;
	}): Promise<TResponse> {
		const response = await fetcher({
			method: 'POST',
			variables: options.variables,
			endpoint: `${rgsBase(options.rgsUrl)}${options.url}`,
		});

		const data = await response.json();
		return data as TResponse;
	},
	get: async function get<
		T extends GetPath,
		TResponse = JsonResponse<PathOperation<T, 'get'>>,
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: `${rgsBase(options.rgsUrl)}${options.url}`,
		});

		const data = await response.json();
		return data as TResponse;
	},
};
