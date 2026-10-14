<script lang="ts">
	import type { FlightRisk, WorldBounds } from '../types';
	import { hunterTrajectory, type HunterShot } from '../flock/hunter';
	import {
		RISK_WEAPONS,
		hunterImage,
		weaponImage,
		type HunterAppearance,
	} from '../flock/mobilePresentation';
	let {
		bounds,
		shot,
		risk = 'safe',
		appearance = 'forest',
	}: {
		bounds: WorldBounds;
		shot?: HunterShot;
		risk?: FlightRisk;
		appearance?: HunterAppearance;
	} = $props();
	const gun = $derived(RISK_WEAPONS[risk]);
	const trajectory = $derived(
		hunterTrajectory(
			bounds,
			shot ?? {
				target: { x: bounds.width * 0.25, y: bounds.height * 0.5 },
				progress: -1,
				hit: false,
			},
			risk,
		),
	);
	const width = $derived(gun.length / (gun.muzzleX - gun.grip));
	const height = $derived(width / 3);
	const flash = $derived(Boolean(shot && shot.progress >= 0 && shot.progress < 0.2));
</script>

<div
	class="hunter"
	data-weapon={gun.id}
	data-hunter={appearance}
	aria-hidden="true"
	style={`transform:translate3d(${trajectory.origin.x - 100 * trajectory.scale}px,${trajectory.origin.y - 73 * trajectory.scale}px,0);width:${160 * trajectory.scale}px;`}
>
	<svg viewBox="0 0 160 200">
		<ellipse cx="110" cy="194" rx="36" ry="5" fill="#0a151a" opacity=".4" />
		<image href={hunterImage(appearance)} width="160" height="200" />
		<g
			transform={`translate(100 73) rotate(${trajectory.angle}) scale(1 ${Math.cos((trajectory.angle * Math.PI) / 180) < 0 ? -1 : 1})`}
		>
			<path
				d="M-15 18 9 5 28 6"
				fill="none"
				stroke={appearance === 'forest' ? '#455445' : '#456779'}
				stroke-width="13"
				stroke-linecap="round"
			/>
			<image
				href={weaponImage(risk)}
				x={-gun.grip * width - (flash ? gun.recoil : 0)}
				y={-gun.muzzleY * height}
				{width}
				{height}
			/>
			<circle cx="8" cy="5" r="5" fill="#caa57b" />
			{#if flash}<path class="flash" d={`M${gun.length} -5 l18 4 -18 7 6-6z`} fill="#ffe49b" />{/if}
		</g>
	</svg>
	<span class="weapon-name">{gun.name}</span>
</div>
{#if shot && shot.progress >= 0 && shot.progress < 1}
	<div
		class="bullet"
		aria-hidden="true"
		style={`transform:translate3d(${trajectory.bullet.x}px,${trajectory.bullet.y}px,0) rotate(${trajectory.angle}deg);`}
	></div>
{/if}

<style>
	.hunter {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 18;
		pointer-events: none;
		filter: drop-shadow(0 3px 4px #08151c88);
	}
	svg {
		width: 100%;
		display: block;
		overflow: visible;
	}
	.weapon-name {
		display: block;
		margin-top: -2px;
		text-align: center;
		color: #f3d694;
		background: #09151ec9;
		border-radius: 6px;
		padding: 3px;
		font:
			700 10px/1.2 system-ui,
			sans-serif;
		white-space: nowrap;
	}
	.bullet {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 24;
		width: 14px;
		height: 3px;
		border-radius: 50%;
		background: #fff3c0;
		box-shadow:
			-8px 0 8px #edb24a,
			0 0 5px #ffd36a;
		pointer-events: none;
	}
	.flash {
		filter: drop-shadow(0 0 5px #ffc75a);
	}
</style>
