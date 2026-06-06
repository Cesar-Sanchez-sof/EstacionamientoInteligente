import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

const ParkingSpace = ({ position, number, statusColor, onClick }) => {
  const getHexColor = (colorStr) => {
    switch (colorStr) {
      case 'green': return '#00ff66';
      case 'red': return '#ff0055';
      case 'blue': return '#00f3ff';
      default: return '#808080';
    }
  };

  return (
    <group position={position} onClick={onClick}>
      {/* Base/Piso del espacio */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.5, 0.1, 5]} />
        <meshStandardMaterial color={getHexColor(statusColor)} opacity={0.6} transparent />
      </mesh>
      
      {/* Líneas delimitadoras */}
      <mesh position={[-1.25, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.1, 5]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[1.25, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.1, 5]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Número */}
      <Text
        position={[0, 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {number}
      </Text>
    </group>
  );
};

const ParkingLot = ({ spaces, onSelectSpace }) => {
  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden shadow-2xl glass-panel">
      <Canvas camera={{ position: [0, 10, 15], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.1} // No ir debajo del suelo
        />
        
        {/* Suelo del estacionamiento */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Render spaces in 2 rows of 5 */}
        {spaces.map((space, index) => {
          const row = Math.floor(index / 5);
          const col = index % 5;
          // Position logic: X spacing 3.0, Z spacing 8.0
          const x = col * 3.0 - 6.0;
          const z = row * 8.0 - 4.0;

          return (
            <ParkingSpace
              key={space.id_lugar}
              position={[x, 0, z]}
              number={space.numero}
              statusColor={space.statusColor}
              onClick={() => onSelectSpace(space)}
            />
          );
        })}
      </Canvas>
    </div>
  );
};

export default ParkingLot;
