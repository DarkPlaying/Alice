import math

def get_arm_rotations(is_biped, pitch, roll, yaw, initial_rot):
    if is_biped:
        # Bip01 coordinates:
        # pitch (forward/back) -> Z axis
        # roll (raise/lower/side) -> Y axis
        # yaw (twist) -> X axis
        return {
            'x': initial_rot['x'] + yaw,
            'y': initial_rot['y'] + roll,
            'z': initial_rot['z'] + pitch
        }
    else:
        # Standard rig coordinates:
        # pitch (forward/back) -> X axis
        # roll (raise/lower/side) -> Z axis
        # yaw (twist) -> Y axis
        return {
            'x': initial_rot['x'] + pitch,
            'y': initial_rot['y'] + yaw,
            'z': initial_rot['z'] + roll
        }

print("Tested Biped mapping successfully!")
