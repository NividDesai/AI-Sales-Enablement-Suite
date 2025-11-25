/**
 * FBXAnimationLoader - Loads FBX animations and applies them to GLB avatars
 * This utility loads Mixamo FBX animations and retargets them to Ready Player Me avatars
 */

import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

export class FBXAnimationLoader {
  private loader: FBXLoader | null = null
  private cache: Map<string, THREE.AnimationClip> = new Map()

  initLoader() {
    if (this.loader) return this.loader
    
    // Initialize FBXLoader
    this.loader = new FBXLoader()
    console.log('✅ FBXLoader initialized from three/examples')
    return this.loader
  }

  /**
   * Load an FBX animation file
   * @param {string} url - Path to FBX file
   * @returns {Promise<THREE.AnimationClip>} Animation clip
   */
  async loadAnimation(url: string): Promise<THREE.AnimationClip> {
    // Ensure loader is initialized
    if (!this.loader) {
      this.initLoader()
    }
    
    if (!this.loader) {
      throw new Error('FBXLoader not available')
    }

    // Check cache
    if (this.cache.has(url)) {
      console.log(`✅ Using cached animation: ${url}`)
      return this.cache.get(url)!
    }

    console.log(`📥 Loading FBX animation: ${url}`)

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (fbx: any) => {
          // FBX files from Mixamo contain animations
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0]
            console.log(`✅ Loaded animation: ${clip.name} (${clip.duration.toFixed(2)}s)`)
            
            // Cache it
            this.cache.set(url, clip)
            resolve(clip)
          } else {
            console.error(`❌ No animations found in: ${url}`)
            reject(new Error('No animations in FBX file'))
          }
        },
        (progress: any) => {
          const percent = (progress.loaded / progress.total) * 100
          if (percent % 25 === 0) {
            console.log(`   Loading: ${percent.toFixed(0)}%`)
          }
        },
        (error: any) => {
          console.error(`❌ Failed to load FBX: ${url}`, error)
          reject(error)
        }
      )
    })
  }

  /**
   * Load multiple FBX animations
   * @param {Object} animations - Map of animation names to URLs
   * @returns {Promise<Map<string, THREE.AnimationClip>>} Map of loaded animations
   */
  async loadAnimations(animations: Record<string, string>): Promise<Map<string, THREE.AnimationClip>> {
    const clips = new Map<string, THREE.AnimationClip>()
    
    for (const [name, url] of Object.entries(animations)) {
      try {
        const clip = await this.loadAnimation(url)
        // Rename clip to match our naming convention
        clip.name = name
        clips.set(name, clip)
      } catch (error: any) {
        console.warn(`⚠️ Skipping ${name}: ${error.message}`)
      }
    }
    
    return clips
  }

  /**
   * Retarget animation from Mixamo to Ready Player Me skeleton
   * This ensures bone names match between Mixamo and RPM avatars
   * @param {THREE.AnimationClip} clip - Animation clip to retarget
   * @param {THREE.Object3D} target - Target avatar (Ready Player Me)
   * @param {string[]} excludeBones - Optional list of bone names to exclude from animation (e.g., ['Jaw', 'jaw'] for lip sync)
   * @returns {THREE.AnimationClip} Retargeted clip
   */
  retargetAnimation(clip: THREE.AnimationClip, target: THREE.Object3D, excludeBones: string[] = []): THREE.AnimationClip {
    console.log(`🔄 Retargeting animation: ${clip.name}`)
    
    // Clone the clip
    const newClip = clip.clone()
    
    // Get all bone names from target avatar - improved detection
    const targetBones = new Map<string, THREE.Bone>() // Use Map to store both name and bone object
    const boneNameVariations = new Map<string, string>() // Store variations for matching
    
    // First, collect all bones from skeleton (most reliable)
    target.traverse((node) => {
      if ((node as any).isSkinnedMesh && (node as any).skeleton) {
        const skeleton = (node as any).skeleton as THREE.Skeleton
        skeleton.bones.forEach(bone => {
          const name = bone.name
          if (!targetBones.has(name)) {
            targetBones.set(name, bone)
            const lowerName = name.toLowerCase()
            boneNameVariations.set(lowerName, name)
            
            // Store without common prefixes/suffixes
            const cleanName = name.replace(/^(mixamorig|mixamo|rpm|avatar)/i, '').trim()
            if (cleanName && cleanName !== name) {
              boneNameVariations.set(cleanName.toLowerCase(), name)
            }
          }
        })
      }
    })
    
    // Also check direct bone nodes
    target.traverse((node) => {
      // Check for bones in multiple ways
      if ((node as any).isBone || 
          node.type === 'Bone' || 
          (node.name && ((node as any).isBone !== undefined))) {
        const name = node.name
        if (!targetBones.has(name)) {
          targetBones.set(name, node as THREE.Bone)
          
          // Store variations for better matching
          const lowerName = name.toLowerCase()
          boneNameVariations.set(lowerName, name)
          
          // Store without common prefixes/suffixes
          const cleanName = name.replace(/^(mixamorig|mixamo|rpm|avatar)/i, '').trim()
          if (cleanName && cleanName !== name) {
            boneNameVariations.set(cleanName.toLowerCase(), name)
          }
        }
      }
    })
    
    console.log(`   Target has ${targetBones.size} bones`)
    if (targetBones.size > 0) {
      const sampleBones = Array.from(targetBones.keys()).slice(0, 10)
      console.log(`   Sample bones:`, sampleBones.join(', '))
    }
    
    // Mixamo to Ready Player Me bone name mapping
    const boneNameMap: Record<string, string> = {
      // Core skeleton
      'mixamorigHips': 'Hips',
      'mixamorigSpine': 'Spine',
      'mixamorigSpine1': 'Spine1',
      'mixamorigSpine2': 'Spine2',
      'mixamorigNeck': 'Neck',
      'mixamorigHead': 'Head',
      
      // Left arm
      'mixamorigLeftShoulder': 'LeftShoulder',
      'mixamorigLeftArm': 'LeftArm',
      'mixamorigLeftForeArm': 'LeftForearm',
      'mixamorigLeftHand': 'LeftHand',
      
      // Right arm
      'mixamorigRightShoulder': 'RightShoulder',
      'mixamorigRightArm': 'RightArm',
      'mixamorigRightForeArm': 'RightForearm',
      'mixamorigRightHand': 'RightHand',
      
      // Left leg
      'mixamorigLeftUpLeg': 'LeftUpperLeg',
      'mixamorigLeftLeg': 'LeftLowerLeg',
      'mixamorigLeftFoot': 'LeftFoot',
      'mixamorigLeftToeBase': 'LeftToes',
      
      // Right leg
      'mixamorigRightUpLeg': 'RightUpperLeg',
      'mixamorigRightLeg': 'RightLowerLeg',
      'mixamorigRightFoot': 'RightFoot',
      'mixamorigRightToeBase': 'RightToes',
    }
    
    // Retarget each track
    const retargetedTracks: THREE.KeyframeTrack[] = []
    let successCount = 0
    let failCount = 0
    const failedBones = new Set<string>()
    
    newClip.tracks.forEach(track => {
      // Extract bone name and property from track name
      // Format: "boneName.property" or "boneName.property[channel]"
      const trackParts = track.name.split('.')
      const boneName = trackParts[0]
      const property = trackParts.slice(1).join('.')
      
      // Remove "mixamorig" prefix if present
      let newBoneName = boneName.replace(/^mixamorig/i, '')
      
      // Check if this bone should be excluded (case-insensitive)
      const shouldExclude = excludeBones.some(excluded => {
        const boneLower = newBoneName.toLowerCase()
        const excludedLower = excluded.toLowerCase()
        return boneLower.includes(excludedLower) || excludedLower.includes(boneLower)
      })
      
      if (shouldExclude) {
        // Skip this track - don't include jaw bone animations for talking animations
        failCount++
        return
      }
      
      // Try direct mapping first
      let targetBoneName = boneNameMap[boneName] || newBoneName
      
      // Check if target has this bone (exact match)
      if (targetBones.has(targetBoneName)) {
        track.name = `${targetBoneName}.${property}`
        retargetedTracks.push(track)
        successCount++
        return
      }
      
      // Try case-insensitive match
      const lowerTarget = targetBoneName.toLowerCase()
      if (boneNameVariations.has(lowerTarget)) {
        const actualName = boneNameVariations.get(lowerTarget)!
        track.name = `${actualName}.${property}`
        retargetedTracks.push(track)
        successCount++
        return
      }
      
      // Try partial matching (for variations like "LeftUpLeg" vs "LeftUpperLeg")
      let found = false
      const alternatives = [
        targetBoneName,
        // Leg variations
        targetBoneName.replace('UpLeg', 'UpperLeg'),
        targetBoneName.replace('UpperLeg', 'UpLeg'),
        targetBoneName.replace('Leg', 'LowerLeg'),
        targetBoneName.replace('LowerLeg', 'Leg'),
        targetBoneName.replace('ToeBase', 'Toes'),
        targetBoneName.replace('Toes', 'ToeBase'),
        // Arm variations
        targetBoneName.replace('ForeArm', 'Forearm'),
        targetBoneName.replace('Forearm', 'ForeArm'),
        // Try with different casing
        targetBoneName.charAt(0).toUpperCase() + targetBoneName.slice(1),
        targetBoneName.toLowerCase(),
        // Try without "Left"/"Right" prefix for matching
        targetBoneName.replace(/^(Left|Right)/, ''),
        // Try with "Left"/"Right" prefix if missing
        targetBoneName.startsWith('Left') || targetBoneName.startsWith('Right') 
          ? targetBoneName 
          : `Left${targetBoneName}`,
        targetBoneName.startsWith('Left') || targetBoneName.startsWith('Right') 
          ? targetBoneName 
          : `Right${targetBoneName}`,
      ]
      
      for (const altName of alternatives) {
        if (targetBones.has(altName)) {
          track.name = `${altName}.${property}`
          retargetedTracks.push(track)
          successCount++
          found = true
          break
        }
        
        // Try case-insensitive
        const altLower = altName.toLowerCase()
        if (boneNameVariations.has(altLower)) {
          const actualName = boneNameVariations.get(altLower)!
          track.name = `${actualName}.${property}`
          retargetedTracks.push(track)
          successCount++
          found = true
          break
        }
      }
      
      if (!found) {
        failCount++
        if (failCount <= 10) { // Log first 10 failures
          failedBones.add(boneName)
        }
      }
    })
    
    if (failedBones.size > 0) {
      console.warn(`   ⚠️ Failed to map bones:`, Array.from(failedBones).slice(0, 10).join(', '))
    }
    console.log(`   ✅ Retargeted ${successCount} tracks, ⚠️ ${failCount} tracks skipped`)
    
    // Update clip with retargeted tracks
    newClip.tracks = retargetedTracks
    
    // Warn if too many tracks failed
    if (failCount > successCount) {
      console.warn(`   ⚠️ More tracks failed than succeeded! Animation may not work correctly.`)
    }
    
    return newClip
  }
}

// Export singleton instance
export const fbxAnimationLoader = new FBXAnimationLoader()

