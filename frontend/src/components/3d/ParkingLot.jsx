import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

const ParkingSpace = ({ position, number, statusColor, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const isSelectable = statusColor === 'green' || statusColor === 'yellow';
  const isSelected = statusColor === 'yellow';

  useEffect(() => {
    if (hovered && isSelectable) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered, isSelectable]);

  const getHexColor = (colorStr) => {
    switch (colorStr) {
      case 'green': return '#00ff66';
      case 'red': return '#ff0055';
      case 'blue': return '#00f3ff';
      case 'yellow': return '#eab308';
      default: return '#808080';
    }
  };

  const targetY = (hovered && isSelectable) ? 0.25 : (isSelected ? 0.1 : 0);

  return (
    <group 
      position={[position[0], position[1] + targetY, position[2]]}
      onClick={(e) => {
        if (isSelectable) {
          e.stopPropagation();
          onClick();
        }
      }}
      onPointerEnter={(e) => {
        if (isSelectable) {
          e.stopPropagation();
          setHovered(true);
        }
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {/* Base/Piso del espacio */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.5, 0.1, 5]} />
        <meshStandardMaterial 
          color={getHexColor(statusColor)} 
          opacity={statusColor === 'yellow' ? 0.95 : 0.6} 
          transparent 
          emissive={getHexColor(statusColor)}
          emissiveIntensity={statusColor === 'yellow' ? 0.4 : (hovered && isSelectable ? 0.2 : 0.1)}
        />
      </mesh>
      
      {/* Líneas delimitadoras */}
      <mesh position={[-1.25, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.1, 5]} />
        <meshStandardMaterial color={statusColor === 'yellow' ? '#eab308' : 'white'} />
      </mesh>
      <mesh position={[1.25, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.1, 5]} />
        <meshStandardMaterial color={statusColor === 'yellow' ? '#eab308' : 'white'} />
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

const ParkingLot = ({ spaces, onSelectSpace, selectedSpace }) => {
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

          const isSelected = selectedSpace && selectedSpace.id_lugar === space.id_lugar;
          const finalColor = isSelected ? 'yellow' : space.statusColor;

          return (
            <ParkingSpace
              key={space.id_lugar}
              position={[x, 0, z]}
              number={space.numero}
              statusColor={finalColor}
              onClick={() => onSelectSpace(space)}
            />
          );
        })}
      </Canvas>
    </div>
  );
};

export default ParkingLot;
