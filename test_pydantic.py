from pydantic import BaseModel
from typing import Optional

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None

# Simulate payload with null
data = TeamUpdate.model_validate({"manager_id": None})
print(data.model_dump(exclude_unset=True))
