import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

const ParkingSpace = ({ position, number, statusColor, isTopRow, onClick }) => {
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
      case 'green': return '#00ff66';   // Neon green (Available)
      case 'red': return '#ff0055';     // Neon red (Occupied)
      case 'blue': return '#00f3ff';    // Neon cyan (Reserved by user)
      case 'yellow': return '#eab308';  // Neon gold (Selected preview)
      default: return '#555860';
    }
  };

  const targetY = (hovered && isSelectable) ? 0.25 : (isSelected ? 0.1 : 0);
  const backZ = isTopRow ? -2.1 : 2.1;
  const numZ = isTopRow ? 1.0 : -1.0;

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
      {/* Piso interior del cajón (Glow del estado) */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[2.14, 0.01, 4.0]} />
        <meshStandardMaterial 
          color={getHexColor(statusColor)} 
          opacity={statusColor === 'yellow' ? 0.95 : 0.45} 
          transparent 
          emissive={getHexColor(statusColor)}
          emissiveIntensity={statusColor === 'yellow' ? 0.6 : (hovered && isSelectable ? 0.4 : 0.25)}
        />
      </mesh>

      {/* Asfalto base del cajón */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[2.22, 0.01, 4.12]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.9} />
      </mesh>
      
      {/* Delimitador de madera izquierdo */}
      <mesh position={[-1.11, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 4.12]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Delimitador de madera derecho */}
      <mesh position={[1.11, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 4.12]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Tope de madera trasero */}
      <mesh position={[0, 0.06, backZ]}>
        <boxGeometry args={[2.3, 0.12, 0.08]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Número en el suelo (lado de la pista) */}
      <Text
        position={[0, 0.025, numZ]}
        rotation={[-Math.PI / 2, 0, isTopRow ? Math.PI : 0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {number}
      </Text>
    </group>
  );
};

// Componente para pintar las franjas de un paso peatonal
const ZebraCrossing = ({ position }) => {
  return (
    <group position={position}>
      {[-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((offsetX, i) => (
        <mesh key={i} position={[offsetX, 0.01, 0]}>
          <boxGeometry args={[0.2, 0.01, 1.5]} />
          <meshBasicMaterial color="#ffffff" opacity={0.85} transparent />
        </mesh>
      ))}
    </group>
  );
};

const ParkingLot = ({ spaces, onSelectSpace, selectedSpace }) => {
  return (
    <div className="w-full h-[520px] rounded-xl overflow-hidden shadow-2xl glass-panel relative border border-gray-800">
      <Canvas camera={{ position: [0, 11, 14], fov: 48 }}>
        <ambientLight intensity={0.65} />
        <pointLight position={[10, 15, 10]} intensity={1.2} />
        <directionalLight position={[-10, 18, -10]} intensity={0.5} castShadow />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.05} // No ir por debajo de la maqueta
        />
        
        {/* Tablero Principal (Suelo Maqueta) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[20, 16]} />
          <meshStandardMaterial color="#1e222b" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* --- SEÑALIZACIÓN VIAL (Líneas segmentadas blancas) --- */}
        {/* Calle Central (Horizontal, entre filas de cajones) */}
        {[-8.5, -6.0, -3.5, -1.0, 1.5, 4.0, 6.5, 8.5].map((posX, i) => (
          <mesh key={`mid-dash-${i}`} position={[posX, 0.01, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* Pista Inferior (Horizontal, abajo de fila 1-5) */}
        {[-8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 8.5].map((posX, i) => (
          <mesh key={`bot-dash-${i}`} position={[posX, 0.01, 5.8]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* Pista Superior (Horizontal, arriba de fila 6-10) */}
        {[-8.5, -5.5, -2.5, 0.5, 3.5, 6.5, 8.5].map((posX, i) => (
          <mesh key={`top-dash-${i}`} position={[posX, 0.01, -5.8]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* Carril Izquierdo (Vertical) */}
        {[-4.0, -1.5, 1.5, 4.0].map((posZ, i) => (
          <mesh key={`left-dash-${i}`} position={[-8.5, 0.01, posZ]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* Carril Derecho (Vertical) */}
        {[-4.0, -1.5, 1.5, 4.0].map((posZ, i) => (
          <mesh key={`right-dash-${i}`} position={[8.5, 0.01, posZ]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* --- PASOS DE CEBRA (Entrada y Salida en zona superior) --- */}
        <ZebraCrossing position={[-4.5, 0, -6.8]} />
        <ZebraCrossing position={[4.5, 0, -6.8]} />

        {/* --- RENDER DE CAJONES DE ESTACIONAMIENTO --- */}
        {spaces.map((space, index) => {
          const isTopRow = index >= 5; // Cajones 6-10 están en la fila superior (index 5 a 9)
          const col = index % 5;
          
          // Posicionamiento de cajones en base a la maqueta física:
          // Separación en X de 2.8 unidades (centrado en X=0)
          const x = col * 2.8 - 5.6; 
          // Fila inferior Z = 3.2, Fila superior Z = -3.2
          const z = isTopRow ? -3.2 : 3.2;

          const isSelected = selectedSpace && selectedSpace.id_lugar === space.id_lugar;
          const finalColor = isSelected ? 'yellow' : space.statusColor;

          return (
            <ParkingSpace
              key={space.id_lugar}
              position={[x, 0, z]}
              number={space.numero}
              statusColor={finalColor}
              isTopRow={isTopRow}
              onClick={() => onSelectSpace(space)}
            />
          );
        })}
      </Canvas>
    </div>
  );
};

export default ParkingLot;
